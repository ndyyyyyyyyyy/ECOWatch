import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { Alert, Button, Field, Modal, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

import {
  trackAIImproveLabelsApplied,
  trackAIImproveLabelsButtonClick,
  trackAIImproveLabelsCancel,
  trackAIImproveLabelsGeneration,
} from '../analytics/tracking';
import { callLLM, extractJsonFromLLMResponse } from '../llmUtils';

import {
  LABELS_GUIDELINES,
  LABELS_RESPONSE_FORMAT,
  createBaseSystemPrompt,
  createUserPrompt,
} from './prompts/commonPrompt';

export interface GenAIImproveLabelsButtonProps {
  disabled?: boolean;
}

interface LabelsImprovementResult {
  labels?: Array<{ key: string; value: string }>;
}

interface LabelsImprovementPreviewProps {
  improvements: LabelsImprovementResult;
  onApply: () => void;
  onCancel: () => void;
}

const LabelsImprovementPreview = ({ improvements, onApply, onCancel }: LabelsImprovementPreviewProps) => {
  const styles = useStyles2(getStyles);

  if (!improvements.labels || improvements.labels.length === 0) {
    return (
      <Alert title={t('alerting.improve-ai-labels.preview.no-improvements', 'No improvements found')} severity="info">
        <Trans i18nKey="alerting.improve-ai-labels.preview.no-improvements-message">
          The AI didn&apos;t suggest any label improvements for this request.
        </Trans>
      </Alert>
    );
  }

  return (
    <div className={styles.preview}>
      <div className={styles.previewHeader}>
        <Trans i18nKey="alerting.improve-ai-labels.preview.title">AI suggested label improvements:</Trans>
      </div>
      <div className={styles.previewContent}>
        {improvements.labels.map((label, index) => (
          <div key={index} className={styles.previewItem}>
            <Text variant="body" weight="bold">
              {label.key}:
            </Text>{' '}
            {label.value}
          </div>
        ))}
      </div>
      <div className={styles.previewActions}>
        <Button onClick={onApply} variant="primary">
          <Trans i18nKey="alerting.improve-ai-labels.preview.apply">Apply improvements</Trans>
        </Button>
        <Button onClick={onCancel} variant="secondary">
          <Trans i18nKey="alerting.improve-ai-labels.preview.cancel">Cancel</Trans>
        </Button>
      </div>
    </div>
  );
};

export const GenAIImproveLabelsButton = ({ disabled }: GenAIImproveLabelsButtonProps) => {
  const { getValues, setValue } = useFormContext<RuleFormValues>();
  const styles = useStyles2(getStyles);

  // Check if LLM plugin is enabled
  const { value: isLLMEnabled, loading: isCheckingLLM } = useAsync(() => isLLMPluginEnabled());

  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [improvements, setImprovements] = useState<LabelsImprovementResult | null>(null);
  const [shouldGenerate, setShouldGenerate] = useState(false);

  const {
    value: generateImprovementsValue,
    loading: isGenerating,
    error: generationError,
  } = useAsync(async () => {
    if (!shouldGenerate || !prompt.trim()) {
      return;
    }

    const currentValues = getValues();
    const messages: llm.Message[] = [
      { role: 'system', content: createBaseSystemPrompt('labels', LABELS_GUIDELINES, LABELS_RESPONSE_FORMAT) },
      createUserPrompt(prompt, currentValues, 'labels'),
    ];
    const content = await callLLM(messages);
    return content;
  }, [shouldGenerate, prompt, getValues]);

  const handleParsedResponse = useCallback((reply: string) => {
    try {
      const parsedImprovements = extractJsonFromLLMResponse(reply);
      setImprovements(parsedImprovements);
      trackAIImproveLabelsGeneration({ success: true });
    } catch (error) {
      console.error('Failed to parse AI label improvements:', error);
      trackAIImproveLabelsGeneration({ success: false, error: stringifyErrorLike(error) });
    }
  }, []);

  useEffect(() => {
    if (generateImprovementsValue && !isGenerating && !generationError) {
      try {
        handleParsedResponse(generateImprovementsValue);
      } catch (error) {
        console.error('Failed to process generation result:', error);
      }
      setShouldGenerate(false);
    }
  }, [generateImprovementsValue, isGenerating, generationError, handleParsedResponse]);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) {
      return;
    }
    setShouldGenerate(true);
  }, [prompt]);

  const handleApplyImprovements = useCallback(() => {
    if (!improvements || !improvements.labels) {
      return;
    }

    const currentValues = getValues();
    const currentLabels = currentValues.labels || [];
    const mergedLabels = [...currentLabels];

    improvements.labels.forEach((newLabel) => {
      const existingIndex = mergedLabels.findIndex((l) => l.key === newLabel.key);
      if (existingIndex >= 0) {
        mergedLabels[existingIndex] = newLabel;
      } else {
        mergedLabels.push(newLabel);
      }
    });

    setValue('labels', mergedLabels);
    trackAIImproveLabelsApplied();

    setShowModal(false);
    setImprovements(null);
    setPrompt('');
  }, [improvements, getValues, setValue]);

  const handleClose = () => {
    if (improvements || prompt.trim()) {
      trackAIImproveLabelsCancel();
    }

    setShowModal(false);
    setPrompt('');
    setImprovements(null);
    setShouldGenerate(false);
  };

  if (isCheckingLLM || !isLLMEnabled) {
    return null;
  }

  return (
    <>
      <Button
        icon="ai"
        size="sm"
        variant="primary"
        fill="text"
        onClick={() => {
          trackAIImproveLabelsButtonClick();
          setShowModal(true);
        }}
        disabled={disabled}
        data-testid="improve-labels-button"
      >
        <Trans i18nKey="alerting.improve-ai-labels.button">Improve labels with AI</Trans>
      </Button>

      <Modal
        title={t('alerting.improve-ai-labels.modal.title', 'Improve Alert Rule Labels with AI')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Field
            label={t('alerting.improve-ai-labels.modal.prompt-label', 'How would you like to improve the labels?')}
            description={t(
              'alerting.improve-ai-labels.modal.prompt-description',
              'Describe what you want to improve about the alert rule labels. For example: "Add dynamic severity labels", "Include team ownership", or "Add environment labels".'
            )}
            noMargin
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.improve-ai-labels.modal.prompt-placeholder',
                'Add dynamic severity labels based on the threshold values and include team ownership...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {generationError && (
            <Alert title={t('alerting.improve-ai-labels.modal.error-title', 'Error')} severity="error">
              <Trans i18nKey="alerting.improve-ai-labels.modal.error">{stringifyErrorLike(generationError)}</Trans>
            </Alert>
          )}

          {improvements && (
            <LabelsImprovementPreview
              improvements={improvements}
              onApply={handleApplyImprovements}
              onCancel={handleClose}
            />
          )}

          <Stack direction="row" gap={2} justifyContent="flex-end">
            <Button onClick={handleClose} variant="secondary">
              <Trans i18nKey="alerting.improve-ai-labels.modal.cancel">Cancel</Trans>
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} variant="primary">
              {isGenerating ? (
                <Trans i18nKey="alerting.improve-ai-labels.modal.generating">Generating...</Trans>
              ) : (
                <Trans i18nKey="alerting.improve-ai-labels.modal.generate">Generate improvements</Trans>
              )}
            </Button>
          </Stack>
        </Stack>
      </Modal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '600px',
    maxWidth: '90vw',
  }),
  preview: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
  }),
  previewHeader: css({
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.h5.fontWeight,
    marginBottom: theme.spacing(2),
  }),
  previewContent: css({
    marginBottom: theme.spacing(2),
  }),
  previewItem: css({
    marginBottom: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  previewActions: css({
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'flex-end',
  }),
});
