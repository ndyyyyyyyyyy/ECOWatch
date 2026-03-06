import { llm } from '@grafana/llm';

import { GetDatasourceMetricsArgs, handleGetDataSources, handleGetDatasourceMetrics } from './dataSourcesPrompt';

// Tool result interface
interface ToolResult {
  success: boolean;
  error?: string;
  // Other properties vary by tool
  [key: string]: unknown;
}

// Tool call handlers registry
export const createToolCallHandlers = () => ({
  get_data_sources: () => handleGetDataSources(),
  get_datasource_metrics: (args: GetDatasourceMetricsArgs) => handleGetDatasourceMetrics(args),
});

type ToolHandlers = ReturnType<typeof createToolCallHandlers>;
type ValidToolName = keyof ToolHandlers;

interface TypedToolCall extends Omit<llm.ToolCall, 'function'> {
  function: {
    name: ValidToolName;
    arguments: string;
  };
}

export const validateToolCall = (toolCall: llm.ToolCall): toolCall is TypedToolCall => {
  const validToolNames = ['get_data_sources', 'get_datasource_metrics'] as const;
  return validToolNames.some((validName) => validName === toolCall.function.name);
};

const validateGetDatasourceMetricsArgs = (args: unknown): args is GetDatasourceMetricsArgs => {
  return typeof args === 'object' && args !== null && 'datasourceUid' in args;
};
/**
 * Process a tool call and return a message
 * @param toolCall - The tool call to process
 * @param handlers - The handlers for the tool calls
 * @returns A promise that resolves to a message
 */
export const processToolCall = async (toolCall: TypedToolCall, handlers: ToolHandlers): Promise<llm.Message> => {
  const { name } = toolCall.function;

  try {
    const args = JSON.parse(toolCall.function.arguments);

    let result: ToolResult;

    if (name === 'get_data_sources') {
      result = await handlers.get_data_sources();
    } else if (name === 'get_datasource_metrics') {
      // Validate the arguments for the get_datasource_metrics tool
      if (!validateGetDatasourceMetricsArgs(args)) {
        throw new Error('Invalid arguments for get_datasource_metrics');
      }
      result = await handlers.get_datasource_metrics(args);
    } else {
      throw new Error(`Unhandled tool call: ${name}`);
    }

    return {
      role: 'tool',
      content: JSON.stringify(result),
      tool_call_id: toolCall.id,
    };
  } catch (error) {
    console.error(`Error processing tool call ${name}:`, error);
    throw error;
  }
};

// Convenience function for processing with validation
export const processValidatedToolCall = async (
  toolCall: llm.ToolCall,
  handlers: ToolHandlers
): Promise<llm.Message> => {
  if (!validateToolCall(toolCall)) {
    throw new Error(`Invalid tool call: ${toolCall.function.name}`);
  }
  return processToolCall(toolCall, handlers);
};

// Process all tool calls for a given response with type safety
export const processToolCalls = async (toolCalls: llm.ToolCall[], handlers: ToolHandlers): Promise<llm.Message[]> => {
  const toolResponses: llm.Message[] = [];

  for (const toolCall of toolCalls) {
    const toolResponse = await processValidatedToolCall(toolCall, handlers);
    toolResponses.push(toolResponse);
  }

  return toolResponses;
};
