import { act, renderHook } from '@testing-library/react';

import { useAsync } from 'app/features/alerting/unified/hooks/useAsync';
import { RuleFormType } from 'app/features/alerting/unified/types/rule-form';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import * as llmUtils from '../llmUtils';

import { useLLMAlertGeneration } from './useLLMAlertGeneration';

// Mock the llmUtils module
jest.mock('../llmUtils', () => ({
  ensureLLMEnabled: jest.fn(),
  extractJsonFromLLMResponse: jest.fn(),
  DEFAULT_LLM_MODEL: 'gpt-4',
  DEFAULT_LLM_TEMPERATURE: 0.1,
}));

// Mock useAsync hook
jest.mock('app/features/alerting/unified/hooks/useAsync');

// Mock analytics tracking
jest.mock('../analytics/tracking', () => ({
  trackAIAlertRuleGeneration: jest.fn(),
}));

// Mock LLM service
jest.mock('@grafana/llm', () => ({
  llm: {
    chatCompletions: jest.fn(),
    Model: {
      LARGE: 'gpt-4',
      SMALL: 'gpt-3.5-turbo',
    },
  },
}));

describe('useLLMAlertGeneration', () => {
  const mockEnsureLLMEnabled = jest.mocked(llmUtils.ensureLLMEnabled);
  const mockUseAsync = jest.mocked(useAsync);

  // Mock useAsync to behave like the real implementation
  let mockExecute: jest.Mock;
  let mockReset: jest.Mock;
  let mockAsyncState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockExecute = jest.fn();
    mockReset = jest.fn();
    mockAsyncState = {
      status: 'not-executed',
      error: null,
      result: null,
    };

    mockUseAsync.mockReturnValue([
      { execute: mockExecute, reset: mockReset },
      mockAsyncState,
      { promise: undefined, lastArgs: undefined },
    ]);

    mockEnsureLLMEnabled.mockResolvedValue(undefined);
  });

  it('should set loading state when generateRule is called', () => {
    mockAsyncState.status = 'loading';

    const { result } = renderHook(() => useLLMAlertGeneration());

    expect(result.current.isGenerating).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.generatedRule).toBeNull();
  });

  it('should clear state when clearState is called', () => {
    const { result } = renderHook(() => useLLMAlertGeneration());

    act(() => {
      result.current.clearState();
    });

    expect(mockReset).toHaveBeenCalled();
  });

  describe('successful rule generation', () => {
    it('should generate rule successfully without tool calls', async () => {
      const mockRule = {
        name: 'Test Alert',
        type: RuleFormType.grafana,
        dataSourceName: 'prometheus',
        group: 'test-group',
        condition: null,
        noDataState: GrafanaAlertStateDecision.NoData,
        execErrState: GrafanaAlertStateDecision.Alerting,
        queries: [],
        labels: [],
        annotations: [],
        folder: undefined,
        evaluateEvery: '1m',
        evaluateFor: '5m',
        manualRouting: false,
        namespace: 'default',
        forTime: 5,
        forTimeUnit: 'm',
        expression: '',
      };

      mockExecute.mockResolvedValue(mockRule);
      mockAsyncState.status = 'success';
      mockAsyncState.result = mockRule;

      const { result } = renderHook(() => useLLMAlertGeneration());

      await act(async () => {
        await result.current.generateRule([
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Create an alert rule' },
        ]);
      });

      expect(result.current.generatedRule).toEqual(mockRule);
    });

    it('should handle rule generation with tool calls', async () => {
      const mockRule = {
        name: 'CPU Alert',
        type: RuleFormType.grafana,
        dataSourceName: 'prometheus',
        group: 'cpu-group',
        condition: null,
        noDataState: GrafanaAlertStateDecision.NoData,
        execErrState: GrafanaAlertStateDecision.Alerting,
        queries: [],
        labels: [],
        annotations: [],
        folder: undefined,
        evaluateEvery: '1m',
        evaluateFor: '2m',
        manualRouting: false,
        namespace: 'default',
        forTime: 2,
        forTimeUnit: 'm',
        expression: '',
      };

      mockExecute.mockResolvedValue(mockRule);
      mockAsyncState.status = 'success';
      mockAsyncState.result = mockRule;

      const { result } = renderHook(() => useLLMAlertGeneration());

      await act(async () => {
        await result.current.generateRule([{ role: 'user', content: 'Create an alert for high CPU usage' }]);
      });

      expect(result.current.generatedRule).toEqual(mockRule);
    });
  });

  describe('error handling', () => {
    it('should handle LLM service unavailable error', async () => {
      const error = new Error('LLM service unavailable');
      mockExecute.mockRejectedValue(error);
      mockAsyncState.status = 'error';
      mockAsyncState.error = error;

      const { result } = renderHook(() => useLLMAlertGeneration());

      await act(async () => {
        try {
          await result.current.generateRule([{ role: 'user', content: 'Create an alert rule' }]);
        } catch (e) {
          // Expected to catch error
        }
      });

      expect(result.current.error).toBe(error);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generatedRule).toBeNull();
    });

    it('should handle LLM request failed error', async () => {
      const error = new Error('LLM request failed');
      mockExecute.mockRejectedValue(error);
      mockAsyncState.status = 'error';
      mockAsyncState.error = error;

      const { result } = renderHook(() => useLLMAlertGeneration());

      await act(async () => {
        try {
          await result.current.generateRule([{ role: 'user', content: 'Create an alert rule' }]);
        } catch (e) {
          // Expected to catch error
        }
      });

      expect(result.current.error).toBe(error);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generatedRule).toBeNull();
    });

    it('should handle JSON parsing error', async () => {
      const error = new Error('Invalid JSON');
      mockExecute.mockRejectedValue(error);
      mockAsyncState.status = 'error';
      mockAsyncState.error = error;

      const { result } = renderHook(() => useLLMAlertGeneration());

      await act(async () => {
        try {
          await result.current.generateRule([{ role: 'user', content: 'Create an alert rule' }]);
        } catch (e) {
          // Expected to catch error
        }
      });

      expect(result.current.error).toBe(error);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generatedRule).toBeNull();
    });

    it('should handle max tool iterations error', async () => {
      const error = new Error('Maximum tool call iterations reached');
      mockExecute.mockRejectedValue(error);
      mockAsyncState.status = 'error';
      mockAsyncState.error = error;

      const { result } = renderHook(() => useLLMAlertGeneration());

      await act(async () => {
        try {
          await result.current.generateRule([{ role: 'user', content: 'Create an alert rule' }]);
        } catch (e) {
          // Expected to catch error
        }
      });

      expect(result.current.error).toBe(error);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generatedRule).toBeNull();
    });

    it('should handle empty response from LLM', async () => {
      const error = new Error('No content received from LLM');
      mockExecute.mockRejectedValue(error);
      mockAsyncState.status = 'error';
      mockAsyncState.error = error;

      const { result } = renderHook(() => useLLMAlertGeneration());

      await act(async () => {
        try {
          await result.current.generateRule([{ role: 'user', content: 'Create an alert rule' }]);
        } catch (e) {
          // Expected to catch error
        }
      });

      expect(result.current.error).toBe(error);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generatedRule).toBeNull();
    });

    it('should handle tool call processing error', async () => {
      const error = new Error('Tool call failed');
      mockExecute.mockRejectedValue(error);
      mockAsyncState.status = 'error';
      mockAsyncState.error = error;

      const { result } = renderHook(() => useLLMAlertGeneration());

      await act(async () => {
        try {
          await result.current.generateRule([{ role: 'user', content: 'Create an alert rule' }]);
        } catch (e) {
          expect(e).toBe(error);
        }
      });

      expect(result.current.error).toBe(error);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generatedRule).toBeNull();
    });
  });
});
