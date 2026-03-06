import { css } from '@emotion/css';
import { useState } from 'react';
import { useAsync } from 'react-use';

import { useListContactPoints } from '@grafana/alerting/unstable';
import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { locationService } from '@grafana/runtime';
import { Alert, Box, Button, Field, Modal, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';
import { isSQLLikeQuery } from 'app/features/alerting/unified/components/rule-viewer/tabs/Query/SQLQueryPreview';
import { createReturnTo } from 'app/features/alerting/unified/hooks/useReturnTo';
import { isExpressionQueryInAlert } from 'app/features/alerting/unified/rule-editor/formProcessing';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { isPromOrLokiQuery } from 'app/features/alerting/unified/utils/rule-form';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { trackAIAlertRuleButtonClick, trackAIAlertRuleCancelled, trackAIAlertRuleUsed } from '../analytics/tracking';

import { processContactPointsForPrompt } from './prompts/contactPointsPrompt';
import { createSystemPrompt, createUserPrompt } from './prompts/rulePrompt';
import { useLLMAlertGeneration } from './useLLMAlertGeneration';

interface AlertRulePreviewProps {
  generatedRule: RuleFormValues;
}

// Helper function to get query expression from model safely
const getQueryExpression = (model: AlertDataQuery): string => {
  // Check for Prometheus/Loki queries (have expr property)
  if (isPromOrLokiQuery(model)) {
    return model.expr || 'Query configured';
  }

  // Check for SQL queries (have rawSql property)
  if (isSQLLikeQuery(model)) {
    return model.rawSql || 'SQL query configured';
  }

  // Check for other common query properties
  if ('query' in model && typeof model.query === 'string') {
    return model.query || 'Query configured';
  }

  // Fallback for other datasource types
  return 'Query configured';
};

// Helper function to summarize queries in a user-friendly way
const summarizeQueries = (queries: AlertQuery[] | undefined): string => {
  if (!queries || queries.length === 0) {
    return 'No queries configured';
  }

  // Get only data source queries (not expressions)
  const dataSourceQueries = queries.filter((query) => !isExpressionQueryInAlert(query));

  if (dataSourceQueries.length === 0) {
    return 'No data queries configured';
  }

  // Get the first data source query and extract its expression
  const firstQuery = dataSourceQueries[0];
  const queryExpression = getQueryExpression(firstQuery.model);

  // Show additional queries count if there are more
  const additionalCount = dataSourceQueries.length - 1;
  const additionalText = additionalCount > 0 ? ` (+${additionalCount} more)` : '';

  return `${queryExpression}${additionalText}`;
};

const AlertRulePreview = ({ generatedRule }: AlertRulePreviewProps) => {
  return (
    <Box padding={2} borderStyle="solid" backgroundColor="secondary" borderColor="weak">
      <h3>
        <Trans i18nKey="alerting.generate-ai-rule.modal.preview-title">Generated Alert Rule</Trans>
      </h3>
      <p>
        <Text variant="body" weight="bold">
          <Trans i18nKey="alerting.generate-ai-rule.modal.preview-name">Name:</Trans>
        </Text>{' '}
        {generatedRule.name}
      </p>
      <p>
        <Text variant="body" weight="bold">
          <Trans i18nKey="alerting.generate-ai-rule.modal.preview-queries">Queries:</Trans>
        </Text>{' '}
        {summarizeQueries(generatedRule.queries)}
      </p>
      {generatedRule.annotations && generatedRule.annotations.length > 0 && (
        <p>
          <Text variant="body" weight="bold">
            <Trans i18nKey="alerting.generate-ai-rule.modal.preview-description">Description:</Trans>
          </Text>{' '}
          {generatedRule.annotations.find((a) => a.key === 'description')?.value}
        </p>
      )}
      {generatedRule.contactPoints?.grafana?.selectedContactPoint && (
        <p>
          <Text variant="body" weight="bold">
            <Trans i18nKey="alerting.generate-ai-rule.modal.preview-contact-point">Contact Point:</Trans>
          </Text>{' '}
          {generatedRule.contactPoints.grafana.selectedContactPoint}
        </p>
      )}
    </Box>
  );
};

export const GenAIAlertRuleButton = () => {
  const styles = useStyles2(getStyles);

  // Check if LLM plugin is enabled
  const { value: isLLMEnabled, loading: isCheckingLLM } = useAsync(() => isLLMPluginEnabled());

  // get contact points data for injecting into the prompt
  const { data: contactPointsData, isLoading: contactPointsLoading } = useListContactPoints();

  // LLM alert generation hook. We can programatically call the generateRule function to generate a rule.
  const { generateRule, generatedRule, isGenerating, error, clearState } = useLLMAlertGeneration();

  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState('');

  // Handle the generation of the alert rule
  const handleGenerate = () => {
    if (!prompt.trim()) {
      return;
    }
    // First we need to process the contact points data to inject into the prompt
    const contactPointsPromptData = processContactPointsForPrompt(contactPointsData, contactPointsLoading);
    // Then we can create the system prompt with the contact points data (contact points are always available)
    const messages: llm.Message[] = [createSystemPrompt(contactPointsPromptData), createUserPrompt(prompt)];
    // Then we can call the LLM with the messages and tools
    generateRule(messages);
  };

  const handleUseRule = () => {
    if (!generatedRule) {
      return;
    }

    trackAIAlertRuleUsed();

    // Navigate to the alert rule form with the generated rule as prefill
    const ruleFormUrl = urlUtil.renderUrl('/alerting/new/alerting', {
      defaults: JSON.stringify(generatedRule),
      returnTo: createReturnTo(),
      fromAI: 'true', // Indicate this rule was generated by AI
    });

    locationService.push(ruleFormUrl);
    setShowModal(false);
  };

  const handleClose = () => {
    if (generatedRule || prompt.trim()) {
      trackAIAlertRuleCancelled();
    }

    setShowModal(false);
    setPrompt('');
    clearState();
  };

  if (isCheckingLLM || !isLLMEnabled) {
    return null;
  }

  return (
    <>
      <Button
        icon="ai"
        fill="text"
        onClick={() => {
          trackAIAlertRuleButtonClick();
          setShowModal(true);
        }}
        data-testid="generate-alert-rule-button"
        variant="primary"
      >
        <Trans i18nKey="alerting.generate-ai-rule.button">Generate with AI</Trans>
      </Button>

      <Modal
        title={t('alerting.generate-ai-rule.modal.title', 'Generate Alert Rule with AI')}
        isOpen={showModal}
        onDismiss={handleClose}
        className={styles.modal}
      >
        <Stack direction="column" gap={3}>
          <Field
            label={t('alerting.generate-ai-rule.modal.prompt-label', 'Describe the alert rule you want to create')}
            description={t(
              'alerting.generate-ai-rule.modal.prompt-description',
              'Describe what you want to monitor and when you want to be alerted. For example: "Alert when CPU usage is above 80% for more than 5 minutes". You can also ask about available contact points or data sources.'
            )}
            noMargin
          >
            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.generate-ai-rule.modal.prompt-placeholder',
                'Alert when disk usage is above 90% for more than 5 minutes and send to Slack contact point...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {error && (
            <Alert
              title={t('alerting.generate-ai-rule.modal.error-title', 'Error generating alert rule')}
              severity="error"
            >
              <Trans i18nKey="alerting.generate-ai-rule.modal.error">{stringifyErrorLike(error)}</Trans>
            </Alert>
          )}

          {generatedRule && <AlertRulePreview generatedRule={generatedRule} />}

          <Stack direction="row" justifyContent="flex-end" gap={2}>
            <Button variant="secondary" onClick={handleClose}>
              <Trans i18nKey="common.cancel">Cancel</Trans>
            </Button>
            {!generatedRule && (
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                icon={isGenerating ? 'spinner' : 'ai'}
              >
                {isGenerating ? (
                  <Trans i18nKey="alerting.generate-ai-rule.modal.generating">Generating...</Trans>
                ) : (
                  <Trans i18nKey="alerting.generate-ai-rule.modal.generate">Generate Rule</Trans>
                )}
              </Button>
            )}
            {generatedRule && (
              <Button variant="primary" onClick={handleUseRule} icon="plus">
                <Trans i18nKey="alerting.generate-ai-rule.modal.use-rule">Use This Rule</Trans>
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
    width: '700px',
    maxWidth: '90vw',
  }),
});
