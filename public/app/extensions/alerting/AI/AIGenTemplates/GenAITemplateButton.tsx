import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { Alert, Button, Field, Modal, Stack, TextArea, useStyles2 } from '@grafana/ui';
import { logError } from 'app/features/alerting/unified/Analytics';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

import {
  trackAITemplateButtonClick,
  trackAITemplateCancelled,
  trackAITemplateGeneration,
  trackAITemplateUsed,
} from '../analytics/tracking';
import { callLLM, extractTemplateFromLLMResponse } from '../llmUtils';

import { createSystemPrompt, createUserPrompt } from './prompt';

export interface GenAITemplateButtonProps {
  onTemplateGenerated: (template: string) => void;
  disabled?: boolean;
}

export const GenAITemplateButton = ({ onTemplateGenerated, disabled }: GenAITemplateButtonProps) => {
  const styles = useStyles2(getStyles);

  // Check if LLM plugin is enabled
  const { value: isLLMEnabled, loading: isCheckingLLM } = useAsync(() => isLLMPluginEnabled());

  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [shouldGenerate, setShouldGenerate] = useState(false);

  const {
    value: generateTemplateValue,
    loading: isGenerating,
    error: generationError,
  } = useAsync(async () => {
    if (!shouldGenerate || !prompt.trim()) {
      return;
    }

    try {
      const messages: llm.Message[] = [createSystemPrompt(), createUserPrompt(prompt)];
      const content = await callLLM(messages);
      return content;
    } catch (error) {
      logError(new Error('Failed to generate template with LLM', { cause: error }));
      trackAITemplateGeneration({ success: false, error: stringifyErrorLike(error) });
      throw error;
    }
  }, [shouldGenerate, prompt]);

  const handleParsedResponse = useCallback(
    (reply: string) => {
      try {
        // Extract template content from the response with robust error handling
        const extractionResult = extractTemplateFromLLMResponse(reply);

        if (extractionResult.success) {
          onTemplateGenerated(extractionResult.content);
          trackAITemplateGeneration({ success: true });
          trackAITemplateUsed();
          setShowModal(false);
        } else {
          logError(new Error('Failed to extract template from LLM response', { cause: extractionResult.error }));
          trackAITemplateGeneration({ success: false, error: stringifyErrorLike(extractionResult.error) });
        }
      } catch (error) {
        logError(new Error('Unexpected error during template extraction', { cause: error }));
        trackAITemplateGeneration({ success: false, error: stringifyErrorLike(error) });
      }
    },
    [onTemplateGenerated]
  );

  useEffect(() => {
    if (generateTemplateValue && !isGenerating && !generationError) {
      try {
        handleParsedResponse(generateTemplateValue);
      } catch (error) {
        logError(new Error('Failed to process generation result', { cause: error }));
      }
      setShouldGenerate(false);
    }
  }, [generateTemplateValue, isGenerating, generationError, handleParsedResponse]);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) {
      return;
    }
    setShouldGenerate(true);
  }, [prompt]);

  const handleClose = () => {
    if (prompt.trim()) {
      trackAITemplateCancelled();
    }

    setShowModal(false);
    setPrompt('');
    setShouldGenerate(false);
  };

  if (isCheckingLLM || !isLLMEnabled) {
    return null;
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        icon="ai"
        fill="text"
        onClick={() => {
          trackAITemplateButtonClick();
          setShowModal(true);
        }}
        disabled={disabled}
        data-testid="generate-template-button"
      >
        <Trans i18nKey="alerting.templates.editor.generate-with-ai">Generate with AI</Trans>
      </Button>

      <Modal
        title={t('alerting.template-form.genai.modal.title', 'Generate Template with AI')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Field
            label={t(
              'alerting.template-form.genai.modal.prompt-label',
              'Describe how you want your notification to look'
            )}
            description={t(
              'alerting.template-form.genai.modal.prompt-description',
              'Describe the format and content you want for your notification. For example: "A Slack message showing alert name, status, and a summary with emoji indicators" or "An email with a table of all firing alerts including their labels and start times".'
            )}
            noMargin
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.template-form.genai.modal.prompt-placeholder',
                'A Slack message that shows "🔥 ALERT: [AlertName] is firing" with a summary and link to view details...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {generationError && (
            <Alert title={t('alerting.template-form.genai.modal.error-title', 'Error')} severity="error">
              <Trans i18nKey="alerting.template-form.genai.modal.error">{stringifyErrorLike(generationError)}</Trans>
            </Alert>
          )}

          <Stack direction="row" justifyContent="flex-end" gap={2}>
            <Button variant="secondary" onClick={handleClose}>
              <Trans i18nKey="common.cancel">Cancel</Trans>
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              icon={isGenerating ? 'spinner' : 'ai'}
            >
              {isGenerating ? (
                <Trans i18nKey="alerting.template-form.genai.modal.generating">Generating...</Trans>
              ) : (
                <Trans i18nKey="alerting.template-form.genai.modal.generate">Generate Template</Trans>
              )}
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
};

const getStyles = () => ({
  modal: css({
    width: '50%',
    maxWidth: 600,
  }),
});
