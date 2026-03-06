import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { createAssistantContextItem, useAssistant } from '@grafana/assistant';
import { GrafanaTheme2, TimeRange, renderMarkdown } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { Alert, Button, Modal, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';
import { logError } from 'app/features/alerting/unified/Analytics';
import { LogRecord } from 'app/features/alerting/unified/components/rules/state-history/common';
import { AIFeedbackButtonComponent } from 'app/features/alerting/unified/enterprise-components/AI/addAIFeedbackButton';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

import { trackAITriageButtonClick, trackAITriageGeneration } from '../analytics/tracking';
import { callLLM } from '../llmUtils';

import { createSystemPrompt, createUserPrompt } from './prompt';

interface TriageAnalysisProps {
  analysis: string;
}

const TriageAnalysis = ({ analysis }: TriageAnalysisProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.analysis}>
      <h4>
        <Trans i18nKey="alerting.triage-ai.modal.analysis-title">Alert Triage Analysis</Trans>
      </h4>
      <div
        className={styles.analysisContent}
        dangerouslySetInnerHTML={{
          // renderMarkdown() converts markdown text into safe HTML
          __html: renderMarkdown(analysis),
        }}
      />
      <AIFeedbackButtonComponent origin="triage" />
    </div>
  );
};

export interface GenAITriageButtonProps {
  logRecords: LogRecord[];
  timeRange: TimeRange;
}

export const GenAITriageButton = ({ logRecords, timeRange }: GenAITriageButtonProps) => {
  const styles = useStyles2(getStyles);
  const [isAssistantAvailable, openAssistant] = useAssistant();
  // Check if LLM plugin is enabled
  const { value: isLLMEnabled, loading: isCheckingLLM } = useAsync(() => isLLMPluginEnabled());

  const [showModal, setShowModal] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [shouldAnalyze, setShouldAnalyze] = useState(false);

  const logRecordsLength = logRecords.length;

  const {
    value: analysisResult,
    loading: isAnalyzing,
    error: analysisError,
  } = useAsync(async () => {
    if (!shouldAnalyze || logRecords.length === 0) {
      return;
    }

    try {
      // Create the prompts
      const systemPrompt = createSystemPrompt();
      const userPrompt = createUserPrompt(logRecords, timeRange, customQuestion.trim() || undefined);
      const messages: llm.Message[] = [systemPrompt, userPrompt];
      const content = await callLLM(messages);

      // Track successful analysis
      trackAITriageGeneration({
        success: true,
        logRecordsCount: logRecordsLength,
      });

      return content;
    } catch (error) {
      logError(new Error('Failed to analyze alerts with LLM'), {
        cause: stringifyErrorLike(error),
      });

      // Track failed analysis
      trackAITriageGeneration({
        success: false,
        logRecordsCount: logRecordsLength,
        error: stringifyErrorLike(error),
      });

      throw error;
    }
  }, [shouldAnalyze, logRecords, timeRange, customQuestion]);

  // Handle opening the modal
  const handleOpenModal = useCallback(() => {
    const systemPrompt = createSystemPrompt();
    const userPrompt = createUserPrompt(logRecords, timeRange, customQuestion.trim() || undefined);
    if (isAssistantAvailable && openAssistant) {
      trackAITriageButtonClick('assistant');
      openAssistant({
        prompt: systemPrompt.content,
        origin: 'alerting',
        context: [
          createAssistantContextItem('structured', {
            title: 'Alert History',
            data: {
              data: userPrompt,
            },
          }),
        ],
      });
      setShowModal(false);
      return;
    }
    trackAITriageButtonClick('llm');
    setShowModal(true);
  }, [isAssistantAvailable, openAssistant, logRecords, timeRange, customQuestion]);

  useEffect(() => {
    if (analysisResult && !isAnalyzing && !analysisError) {
      setAnalysis(analysisResult);
      setShouldAnalyze(false);
    }
  }, [analysisResult, isAnalyzing, analysisError]);

  // Handle LLM call without tools: we inject the log records into the prompt instead of using tools
  const handleAnalyze = useCallback(() => {
    if (logRecords.length === 0) {
      return;
    }
    setShouldAnalyze(true);
  }, [logRecords.length]);

  const handleClose = () => {
    setShowModal(false);
    setAnalysis(null);
    setCustomQuestion('');
    setShouldAnalyze(false);
  };

  if (isCheckingLLM || !isLLMEnabled) {
    return null;
  }

  return (
    <>
      <Button
        variant="primary"
        icon="ai"
        fill="text"
        onClick={handleOpenModal}
        data-testid="triage-ai-button"
        disabled={logRecords.length === 0}
      >
        <Trans i18nKey="alerting.triage-ai.button" values={{ provider: isAssistantAvailable ? 'Assistant' : 'LLM' }}>
          Analyze with {'{{ provider }}'}
        </Trans>
      </Button>

      <Modal
        title={t('alerting.triage-ai.modal.title', 'Alert Triage Analysis')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Text variant="body">
            <Trans i18nKey="alerting.triage-ai.modal.description">
              AI analysis of current alert events to help understand patterns, prioritize response, and identify
              potential issues.
            </Trans>
          </Text>
          {!analysis && (
            <Stack direction="column" gap={1}>
              <Text variant="h6">
                <Trans i18nKey="alerting.triage-ai.modal.custom-question.label">
                  Ask a specific question (optional)
                </Trans>
              </Text>
              <TextArea
                placeholder={t(
                  'alerting.triage-ai.modal.custom-question.placeholder',
                  `e.g., "What's causing the database alerts ? " or "Are these alerts related to the recent deployment ? "`
                )}
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.currentTarget.value)}
                rows={3}
                disabled={isAnalyzing}
              />
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="alerting.triage-ai.modal.custom-question.help">
                  Leave empty for general triage analysis, or ask a specific question about the alert events.
                </Trans>
              </Text>
            </Stack>
          )}

          {analysisError && (
            <Alert title={t('alerting.triage-ai.modal.error', 'Error')} severity="error">
              {stringifyErrorLike(analysisError)}
            </Alert>
          )}

          {isAnalyzing && (
            <div className={styles.analyzing}>
              <Text variant="body">
                <Trans i18nKey="alerting.triage-ai.modal.analyzing" values={{ logRecordsLength }}>
                  🤖 Analyzing {{ logRecordsLength }} alert events...
                </Trans>
              </Text>
            </div>
          )}

          {analysis && <TriageAnalysis analysis={analysis} />}

          <Stack direction="row" justifyContent="flex-end" gap={2}>
            <Button variant="secondary" onClick={handleClose}>
              <Trans i18nKey="common.close">Close</Trans>
            </Button>
            {!analysis && !isAnalyzing && (
              <Button variant="primary" onClick={handleAnalyze} icon="ai">
                <Trans i18nKey="alerting.triage-ai.modal.analyze">Analyze</Trans>
              </Button>
            )}
          </Stack>
        </Stack>
      </Modal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '80%',
    maxWidth: '900px',
    maxHeight: '80vh',
  }),
  analyzing: css({
    color: theme.colors.info.text,
    backgroundColor: theme.colors.info.main,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    textAlign: 'center',
  }),
  analysis: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
  }),
  analysisContent: css({
    marginTop: theme.spacing(1),
  }),
});
