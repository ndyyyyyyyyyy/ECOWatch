import { useCallback } from 'react';

import { llm } from '@grafana/llm';
import { useAsync } from 'app/features/alerting/unified/hooks/useAsync';
import { getDefaultFormValues } from 'app/features/alerting/unified/rule-editor/formDefaults';
import { RuleFormType, RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';

import { trackAIAlertRuleGeneration } from '../analytics/tracking';
import { DEFAULT_LLM_MODEL, DEFAULT_LLM_TEMPERATURE, ensureLLMEnabled, extractJsonFromLLMResponse } from '../llmUtils';

import { GET_DATASOURCE_METRICS_TOOL, GET_DATA_SOURCES_TOOL } from './prompts/dataSourcesPrompt';
import { createToolCallHandlers, processToolCalls } from './prompts/toolHandlers';

// Constants for LLM tool calling
const MAX_TOOL_ITERATIONS = 5;
const TOOL_CALL_TIMEOUT_ERROR = 'Maximum tool call iterations reached. The AI might be stuck in a loop.';

// Helper functions for LLM response processing
const hasToolCalls = (response: llm.ChatCompletionsResponse): boolean => {
  return Boolean(response.choices[0]?.message?.tool_calls);
};

const extractFinalContent = (response: llm.ChatCompletionsResponse): string => {
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content received from LLM');
  }
  return content;
};

const createAssistantMessageWithTools = (message: llm.Message): llm.Message => {
  return {
    role: 'assistant',
    content: message.content,
    tool_calls: message.tool_calls,
  };
};

// Parse and validate the LLM response
const parseAlertRuleResponse = (reply: string): RuleFormValues => {
  // Extract and parse JSON from the response - handle code blocks and other formatting
  const parsedRule = extractJsonFromLLMResponse(reply);

  // Merge with default values to ensure all required fields are present
  const defaultValues = getDefaultFormValues();
  const completeRule: RuleFormValues = {
    ...defaultValues,
    ...parsedRule,
    type: RuleFormType.grafana, // Ensure it's always Grafana-managed
  };

  return completeRule;
};

// Core LLM tool calling logic
const executeToolCallingConversation = async (messages: llm.Message[]): Promise<RuleFormValues> => {
  try {
    // Check if LLM service is available
    await ensureLLMEnabled();

    // Initialize conversation with provided messages
    const conversationMessages = [...messages];
    const toolHandlers = createToolCallHandlers();

    // Iterative tool calling loop
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      // Call the LLM with the conversation and available tools
      const response = await llm.chatCompletions({
        model: DEFAULT_LLM_MODEL,
        messages: conversationMessages,
        tools: [GET_DATA_SOURCES_TOOL, GET_DATASOURCE_METRICS_TOOL],
        temperature: DEFAULT_LLM_TEMPERATURE,
      });

      // Check if the response contains tool calls
      if (hasToolCalls(response)) {
        // Tool calls path: process tools, add them to the conversation, and continue
        const message = response.choices[0]?.message;
        if (message) {
          const assistantMessage = createAssistantMessageWithTools(message);
          conversationMessages.push(assistantMessage);
        }

        // Process all tool calls and add their responses to the conversation
        const toolCalls = response.choices[0]?.message?.tool_calls;
        if (toolCalls) {
          const toolResponses = await processToolCalls(toolCalls, toolHandlers);
          conversationMessages.push(...toolResponses);
        }
        // Continue to next iteration
        continue;
      } else {
        // Final response path: no more tool calls, handle the result
        const finalContent = extractFinalContent(response);
        const generatedRule = parseAlertRuleResponse(finalContent);

        // Track successful generation
        trackAIAlertRuleGeneration({ success: true });

        return generatedRule;
      }
    }

    // If we reach here, we've exceeded max iterations
    throw new Error(TOOL_CALL_TIMEOUT_ERROR);
  } catch (error) {
    console.error('Failed to generate alert rule with LLM:', error);
    const errorMessage = stringifyErrorLike(error);
    trackAIAlertRuleGeneration({ success: false, hasTools: true, error: errorMessage });
    throw error; // Re-throw to let useAsync handle it
  }
};

export interface UseLLMAlertGenerationReturn {
  generateRule: (messages: llm.Message[]) => Promise<RuleFormValues | null>;
  generatedRule: RuleFormValues | null;
  isGenerating: boolean;
  error: Error | null;
  clearState: () => void;
}

export const useLLMAlertGeneration = (): UseLLMAlertGenerationReturn => {
  const [actions, state] = useAsync(executeToolCallingConversation, null);

  const generateRule = actions.execute;

  const clearState = useCallback(() => {
    actions.reset();
  }, [actions]);

  return {
    generateRule,
    generatedRule: state.result,
    isGenerating: state.status === 'loading' && !state.error,
    error: state.error || null,
    clearState,
  };
};
