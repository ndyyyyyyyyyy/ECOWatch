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
  trackAIImproveAnnotationsApplied,
  trackAIImproveAnnotationsButtonClick,
  trackAIImproveAnnotationsCancel,
  trackAIImproveAnnotationsGeneration,
} from '../analytics/tracking';
import { callLLM, extractJsonFromLLMResponse } from '../llmUtils';

import {
  ANNOTATIONS_GUIDELINES,
  ANNOTATIONS_RESPONSE_FORMAT,
  createBaseSystemPrompt,
  createUserPrompt,
} from './prompts/commonPrompt';

export interface GenAIImproveAnnotationsButtonProps {
  disabled?: boolean;
}

interface AnnotationsImprovementResult {
  annotations?: Array<{ key: string; value: string }>;
}

interface AnnotationsImprovementPreviewProps {
  improvements: AnnotationsImprovementResult;
  onApply: () => void;
  onCancel: () => void;
}

const AnnotationsImprovementPreview = ({ improvements, onApply, onCancel }: AnnotationsImprovementPreviewProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.preview}>
      <h4>
        <Trans i18nKey="alerting.improve-ai-annotations.modal.preview-title">AI Annotations Improvements Preview</Trans>
      </h4>
      <div className={styles.improvementPreview}>
        {improvements.annotations && improvements.annotations.length > 0 && (
          <div className={styles.improvementSection}>
            <Text variant="body" weight="bold">
              <Trans i18nKey="alerting.improve-ai-annotations.modal.preview-annotations">Improved Annotations:</Trans>
            </Text>
            <ul>
              {improvements.annotations.map((annotation, index) => (
                <li key={index}>
                  <code>{annotation.key}</code>: {annotation.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Stack direction="row" justifyContent="flex-end" gap={2}>
        <Button variant="secondary" onClick={onCancel}>
          <Trans i18nKey="common.cancel">Cancel</Trans>
        </Button>
        <Button variant="primary" onClick={onApply}>
          <Trans i18nKey="alerting.improve-ai-annotations.modal.apply-improvements">
            Apply Annotation Improvements
          </Trans>
        </Button>
      </Stack>
    </div>
  );
};

export const GenAIImproveAnnotationsButton = ({ disabled }: GenAIImproveAnnotationsButtonProps) => {
  const styles = useStyles2(getStyles);
  const { getValues, setValue } = useFormContext<RuleFormValues>();

  // Check if LLM plugin is enabled
  const { value: isLLMEnabled, loading: isCheckingLLM } = useAsync(() => isLLMPluginEnabled());

  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [improvements, setImprovements] = useState<AnnotationsImprovementResult | null>(null);
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
      {
        role: 'system',
        content: createBaseSystemPrompt('annotations', ANNOTATIONS_GUIDELINES, ANNOTATIONS_RESPONSE_FORMAT),
      },
      createUserPrompt(prompt, currentValues, 'annotations'),
    ];
    const content = await callLLM(messages);
    return content;
  }, [shouldGenerate, prompt, getValues]);

  const handleParsedResponse = useCallback((reply: string) => {
    try {
      const parsedImprovements = extractJsonFromLLMResponse(reply);
      setImprovements(parsedImprovements);
      trackAIImproveAnnotationsGeneration({ success: true });
    } catch (error) {
      console.error('Failed to parse AI annotation improvements:', error);
      trackAIImproveAnnotationsGeneration({ success: false, error: stringifyErrorLike(error) });
    }
  }, []);

  // Handle successful generation
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
    if (!improvements || !improvements.annotations) {
      return;
    }

    const currentValues = getValues();
    const currentAnnotations = currentValues.annotations || [];
    const mergedAnnotations = [...currentAnnotations];

    improvements.annotations.forEach((newAnnotation) => {
      const existingIndex = mergedAnnotations.findIndex((a) => a.key === newAnnotation.key);
      if (existingIndex >= 0) {
        mergedAnnotations[existingIndex] = newAnnotation;
      } else {
        mergedAnnotations.push(newAnnotation);
      }
    });

    setValue('annotations', mergedAnnotations);
    trackAIImproveAnnotationsApplied();

    setShowModal(false);
    setImprovements(null);
    setPrompt('');
  }, [improvements, getValues, setValue]);

  const handleClose = () => {
    if (improvements || prompt.trim()) {
      trackAIImproveAnnotationsCancel();
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
          trackAIImproveAnnotationsButtonClick();
          setShowModal(true);
        }}
        disabled={disabled}
        data-testid="improve-annotations-button"
      >
        <Trans i18nKey="alerting.improve-ai-annotations.button">Improve annotations with AI</Trans>
      </Button>

      <Modal
        title={t('alerting.improve-ai-annotations.modal.title', 'Improve Alert Rule Annotations with AI')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Field
            label={t(
              'alerting.improve-ai-annotations.modal.prompt-label',
              'How would you like to improve the annotations?'
            )}
            description={t(
              'alerting.improve-ai-annotations.modal.prompt-description',
              'Describe what you want to improve about the alert rule annotations. For example: "Make the summary more descriptive", "Add troubleshooting steps to the description", or "Add runbook links".'
            )}
            noMargin
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.improve-ai-annotations.modal.prompt-placeholder',
                'Make the summary more descriptive and add troubleshooting steps to the description...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {generationError && (
            <Alert title={t('alerting.improve-ai-annotations.modal.error-title', 'Error')} severity="error">
              <Trans i18nKey="alerting.improve-ai-annotations.modal.error">{stringifyErrorLike(generationError)}</Trans>
            </Alert>
          )}

          {improvements && (
            <AnnotationsImprovementPreview
              improvements={improvements}
              onApply={handleApplyImprovements}
              onCancel={() => setImprovements(null)}
            />
          )}

          {!improvements && (
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
                  <Trans i18nKey="alerting.improve-ai-annotations.modal.generating">Generating...</Trans>
                ) : (
                  <Trans i18nKey="alerting.improve-ai-annotations.modal.generate">Improve Annotations</Trans>
                )}
              </Button>
            </Stack>
          )}
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
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  improvementPreview: css({
    marginTop: theme.spacing(1),
  }),
  improvementSection: css({
    marginBottom: theme.spacing(2),
    '& ul': {
      backgroundColor: theme.colors.background.primary,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(0.5, 0),
    },
    '& li': {
      marginBottom: theme.spacing(0.5),
    },
    '& code': {
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing(0.25, 0.5),
      borderRadius: theme.shape.radius.default,
      fontSize: theme.typography.bodySmall.fontSize,
    },
  }),
});
