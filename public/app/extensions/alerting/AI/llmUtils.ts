import { marked } from 'marked';

import { llm } from '@grafana/llm';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

export const DEFAULT_LLM_MODEL: llm.Model = llm.Model.LARGE;
export const DEFAULT_LLM_TEMPERATURE = 0.1;

/**
 * Ensures LLM plugin is enabled and available
 */
export const ensureLLMEnabled = async (): Promise<void> => {
  const isEnabled = await isLLMPluginEnabled();
  if (!isEnabled) {
    throw new Error('LLM plugin is not enabled or available');
  }
};

/**
 * Extracts and parses JSON from LLM response
 * @param response Raw LLM response string
 * @returns Parsed JSON object
 * @throws Error if JSON parsing fails or no valid JSON is found
 */
export const extractJsonFromLLMResponse = (response: string): any => {
  // Parse markdown into tokens
  const tokens = marked.lexer(response.trim());

  // Look for code blocks in the AST
  for (const token of tokens) {
    if (token.type === 'code') {
      // Check if it's a JSON code block or generic code block
      if (!token.lang || token.lang === 'json' || token.lang === '') {
        try {
          return JSON.parse(token.text);
        } catch (error) {
          // Continue to next code block if this one fails to parse
          continue;
        }
      }
    }
  }

  // If no code blocks found, try to find JSON object in plain text
  const jsonStart = response.indexOf('{');
  const jsonEnd = response.lastIndexOf('}');

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const jsonCandidate = response.substring(jsonStart, jsonEnd + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON from LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  throw new Error('No valid JSON found in LLM response');
};

/**
 * Result type for template extraction operations
 */
export interface ExtractionResult {
  success: boolean;
  content: string;
  error?: string;
  strategy?: 'code-block' | 'direct-validation' | 'quoted-content'; // Which parsing strategy was used
}

/**
 * Helper function to extract content from code blocks using markdown AST
 * @param content The content to search for code blocks
 * @returns ExtractionResult if code block found, null if no code block
 */
const extractFromCodeBlock = (content: string): ExtractionResult | null => {
  const tokens = marked.lexer(content.trim());

  for (const token of tokens) {
    if (token.type === 'code') {
      // Accept any language or no language specified
      const extracted = token.text.trim();
      if (extracted.length > 0) {
        return {
          success: true,
          content: extracted,
          strategy: 'code-block',
        };
      } else {
        return {
          success: false,
          content: '',
          error: 'Empty code block found in response',
        };
      }
    }
  }

  return null;
};

/**
 * Extracts template content from LLM response
 *
 * With explicit prompt instructions, LLMs should return clean template content directly.
 * This function uses markdown AST parsing for robust extraction of template content.
 *
 * @param response Raw LLM response string
 * @returns Extraction result with success status, content, and strategy used
 */
export const extractTemplateFromLLMResponse = (response: string): ExtractionResult => {
  if (!response) {
    return {
      success: false,
      content: '',
      error: 'Empty response received from LLM',
    };
  }

  const trimmed = response.trim();

  // Early validation for obvious non-template content
  if (!trimmed.includes('{{') || !trimmed.includes('}}')) {
    return {
      success: false,
      content: '',
      error: 'No template syntax found in response',
    };
  }

  // Check if content is wrapped in quotes first
  const isWrappedInQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"));

  if (isWrappedInQuotes) {
    // Remove quotes and process the inner content
    const innerContent = trimmed.slice(1, -1).trim();

    // Check if the quoted content contains a code block
    const codeBlockResult = extractFromCodeBlock(innerContent);
    if (codeBlockResult) {
      return codeBlockResult;
    }

    // Otherwise use the quoted content directly
    return {
      success: true,
      content: innerContent,
      strategy: 'quoted-content',
    };
  }

  // Handle when the content is not wrapped in quotes
  // First check for code blocks
  const codeBlockResult = extractFromCodeBlock(trimmed);
  if (codeBlockResult) {
    return codeBlockResult;
  }

  // Finally, use direct validation (unwrapped, no code blocks, and includes template syntax)
  return {
    success: true,
    content: trimmed,
    strategy: 'direct-validation',
  };
};

/**
 * Common LLM chat completion with standard error handling
 */
export const callLLM = async (messages: llm.Message[], options?: { temperature?: number }): Promise<string> => {
  await ensureLLMEnabled();

  const response = await llm.chatCompletions({
    model: DEFAULT_LLM_MODEL,
    messages,
    temperature: options?.temperature ?? DEFAULT_LLM_TEMPERATURE,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response content from LLM');
  }

  return content;
};
