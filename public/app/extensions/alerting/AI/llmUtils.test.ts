import { llm } from '@grafana/llm';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

import {
  callLLM,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TEMPERATURE,
  ensureLLMEnabled,
  extractJsonFromLLMResponse,
  extractTemplateFromLLMResponse,
} from './llmUtils';

// Mock dependencies
jest.mock('@grafana/llm');
jest.mock('app/features/dashboard/components/GenAI/utils');

const mockIsLLMPluginEnabled = jest.mocked(isLLMPluginEnabled);
const mockLLM = llm as unknown as jest.MockedObject<typeof llm>;

describe('llmUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureLLMEnabled', () => {
    it('should not throw when LLM plugin is enabled', async () => {
      mockIsLLMPluginEnabled.mockResolvedValue(true);

      await expect(ensureLLMEnabled()).resolves.not.toThrow();
    });

    it('should throw when LLM plugin is not enabled', async () => {
      mockIsLLMPluginEnabled.mockResolvedValue(false);

      await expect(ensureLLMEnabled()).rejects.toThrow('LLM plugin is not enabled or available');
    });
  });

  describe('extractJsonFromLLMResponse', () => {
    it('should extract and parse JSON from code block response', () => {
      const response = '```json\n{"key": "value"}\n```';
      const result = extractJsonFromLLMResponse(response);
      expect(result).toEqual({ key: 'value' });
    });

    it('should extract and parse JSON from generic code block response', () => {
      const response = '```\n{"key": "value"}\n```';
      const result = extractJsonFromLLMResponse(response);
      expect(result).toEqual({ key: 'value' });
    });

    it('should extract and parse JSON from plain text response', () => {
      const response = 'Here is your JSON: {"key": "value"} and some text after';
      const result = extractJsonFromLLMResponse(response);
      expect(result).toEqual({ key: 'value' });
    });

    it('should throw error if no valid JSON found', () => {
      const response = 'No JSON here';
      expect(() => extractJsonFromLLMResponse(response)).toThrow('No valid JSON found in LLM response');
    });

    it('should handle multiple JSON objects and return the parsed outermost one', () => {
      const response = '{"outer": {"inner": "value"}}';
      const result = extractJsonFromLLMResponse(response);
      expect(result).toEqual({ outer: { inner: 'value' } });
    });
  });

  describe('extractTemplateFromLLMResponse', () => {
    it('should extract template from go code block using code-block strategy', () => {
      const response = '```go\n{{ range .Alerts }}\nAlert: {{ .Labels.alertname }}\n{{ end }}\n```';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('{{ range .Alerts }}\nAlert: {{ .Labels.alertname }}\n{{ end }}');
      expect(result.strategy).toBe('code-block');
    });

    it('should extract template from template code block', () => {
      const response = '```template\n{{ .Status }}: {{ .CommonLabels.alertname }}\n```';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('{{ .Status }}: {{ .CommonLabels.alertname }}');
      expect(result.strategy).toBe('code-block');
    });

    it('should extract template from generic code block', () => {
      const response = '```\n{{ .Summary }}\n```';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('{{ .Summary }}');
      expect(result.strategy).toBe('code-block');
    });

    it('should extract template from json code block', () => {
      const response = '```json\n{\n  "text": "{{ .CommonLabels.alertname }}"\n}\n```';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('{\n  "text": "{{ .CommonLabels.alertname }}"\n}');
      expect(result.strategy).toBe('code-block');
    });

    it('should extract template from text code block', () => {
      const response = '```text\nAlert: {{ .Labels.alertname }}\nStatus: {{ .Status }}\n```';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('Alert: {{ .Labels.alertname }}\nStatus: {{ .Status }}');
      expect(result.strategy).toBe('code-block');
    });

    it('should remove double quotes using quoted-content strategy', () => {
      const response = '"{{ .Status }}: {{ .CommonLabels.alertname }}"';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('{{ .Status }}: {{ .CommonLabels.alertname }}');
      expect(result.strategy).toBe('quoted-content');
    });

    it('should remove single quotes using quoted-content strategy', () => {
      const response = "'{{ .Status }}: {{ .CommonLabels.alertname }}'";
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('{{ .Status }}: {{ .CommonLabels.alertname }}');
      expect(result.strategy).toBe('quoted-content');
    });

    it('should handle direct template content using direct-validation strategy', () => {
      const response = '{{ .Status }}: {{ .CommonLabels.alertname }}';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('{{ .Status }}: {{ .CommonLabels.alertname }}');
      expect(result.strategy).toBe('direct-validation');
    });

    it('should fail for non-template content', () => {
      const response = 'Plain text without template syntax';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(false);
      expect(result.content).toBe('');
      expect(result.error).toBe('No template syntax found in response');
    });

    it('should handle mixed content and extract first code block', () => {
      const response = 'Here is your template:\n```go\n{{ .Status }}\n```\nAnd some more text.';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('{{ .Status }}');
      expect(result.strategy).toBe('code-block');
    });

    it('should fail gracefully for empty code blocks', () => {
      const response = '```go\n\n```';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(false);
      expect(result.content).toBe('');
      expect(result.error).toBe('No template syntax found in response');
    });

    it('should fail gracefully for whitespace-only code blocks', () => {
      const response = '```template\n   \n  \n```';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(false);
      expect(result.content).toBe('');
      expect(result.error).toBe('No template syntax found in response');
    });

    it('should fail for null input', () => {
      const result = extractTemplateFromLLMResponse(null as any);
      expect(result.success).toBe(false);
      expect(result.content).toBe('');
      expect(result.error).toBe('Empty response received from LLM');
    });

    it('should fail for undefined input', () => {
      const result = extractTemplateFromLLMResponse(undefined as any);
      expect(result.success).toBe(false);
      expect(result.content).toBe('');
      expect(result.error).toBe('Empty response received from LLM');
    });

    it('should fail for empty string input', () => {
      const result = extractTemplateFromLLMResponse('');
      expect(result.success).toBe(false);
      expect(result.content).toBe('');
      expect(result.error).toBe('Empty response received from LLM');
    });

    it('should fail for whitespace-only input', () => {
      const result = extractTemplateFromLLMResponse('   \n  \t  ');
      const expectedError = 'No template syntax found in response';
      expect(result.success).toBe(false);
      expect(result.content).toBe('');
      expect(result.error).toBe(expectedError);
    });

    it('should handle complex multiline template', () => {
      const response = `\`\`\`go
{{ range .Alerts }}
🔥 **{{ .Labels.alertname }}** is {{ .Status }}
📊 **Summary:** {{ .Annotations.summary }}
🔗 [View Details]({{ .GeneratorURL }})
{{ end }}
\`\`\``;
      const expected = `{{ range .Alerts }}
🔥 **{{ .Labels.alertname }}** is {{ .Status }}
📊 **Summary:** {{ .Annotations.summary }}
🔗 [View Details]({{ .GeneratorURL }})
{{ end }}`;
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe(expected);
      expect(result.strategy).toBe('code-block');
    });

    it('should handle quotes around code blocks', () => {
      const response = '"```go\n{{ .Status }}\n```"';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('{{ .Status }}');
      expect(result.strategy).toBe('code-block');
    });

    it('should handle code blocks with extra whitespace', () => {
      const response = '```go   \n\n   {{ .Status }}   \n\n   ```';
      const result = extractTemplateFromLLMResponse(response);
      expect(result.success).toBe(true);
      expect(result.content).toBe('{{ .Status }}');
      expect(result.strategy).toBe('code-block');
    });
  });

  describe('callLLM', () => {
    it('should call LLM with correct parameters', async () => {
      mockIsLLMPluginEnabled.mockResolvedValue(true);
      mockLLM.chatCompletions.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      } as any);

      const messages: llm.Message[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ];

      const result = await callLLM(messages);

      expect(mockLLM.chatCompletions).toHaveBeenCalledWith({
        model: DEFAULT_LLM_MODEL,
        messages,
        temperature: DEFAULT_LLM_TEMPERATURE,
      });
      expect(result).toBe('Test response');
    });

    it('should use custom temperature when provided', async () => {
      mockIsLLMPluginEnabled.mockResolvedValue(true);
      mockLLM.chatCompletions.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
      } as any);

      const messages: llm.Message[] = [{ role: 'user', content: 'Hello' }];
      const customTemperature = 0.5;

      await callLLM(messages, { temperature: customTemperature });

      expect(mockLLM.chatCompletions).toHaveBeenCalledWith({
        model: DEFAULT_LLM_MODEL,
        messages,
        temperature: customTemperature,
      });
    });

    it('should throw error when no content in response', async () => {
      mockIsLLMPluginEnabled.mockResolvedValue(true);
      mockLLM.chatCompletions.mockResolvedValue({
        choices: [{ message: {} }],
      } as any);

      const messages: llm.Message[] = [{ role: 'user', content: 'Hello' }];

      await expect(callLLM(messages)).rejects.toThrow('No response content from LLM');
    });
  });
});
