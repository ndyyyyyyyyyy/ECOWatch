import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, Field, Icon, Stack, Text, TextArea, useStyles2 } from '@grafana/ui';
import {
  AIFeedbackOrigin,
  GenAIFeedbackButtonProps,
} from 'app/features/alerting/unified/enterprise-components/AI/addAIFeedbackButton';
import { useURLSearchParams } from 'app/features/alerting/unified/hooks/useURLSearchParams';

import { trackAIAlertRuleFeedback, trackAITemplateFeedback, trackAITriageFeedback } from '../analytics/tracking';

// For the main public API component

// For internal components that manage feedback state
interface AIFeedbackWithStateProps extends GenAIFeedbackButtonProps {
  feedbackGiven: boolean;
  setFeedbackGiven: (feedbackGiven: boolean) => void;
}

// Map origins to their corresponding tracking functions
const getTrackingFunction = (origin: AIFeedbackOrigin) => {
  switch (origin) {
    case 'alert-rule':
      return trackAIAlertRuleFeedback;
    case 'template':
      return trackAITemplateFeedback;
    case 'triage':
      return trackAITriageFeedback;
  }
};

/**
 * Pure feedback UI component without route detection.
 * Used internally and by the extension system.
 */
export const AIFeedbackWithoutRouteDetection = ({
  shouldShowFeedbackButton,
  feedbackGiven,
  setFeedbackGiven,
  origin,
}: AIFeedbackWithStateProps) => {
  const styles = useStyles2(getStyles);
  const [showCommentField, setShowCommentField] = useState(true);
  const [comment, setComment] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<boolean | null>(null);

  const handleSubmitWithComment = useCallback(() => {
    if (selectedFeedback !== null) {
      getTrackingFunction(origin)({
        helpful: selectedFeedback,
        comment: comment.trim() || undefined,
      });
      setShowCommentField(false);
      setFeedbackGiven(true);
    }
  }, [selectedFeedback, comment, origin, setFeedbackGiven]);

  const handleSkipComment = useCallback(() => {
    if (selectedFeedback !== null) {
      getTrackingFunction(origin)({
        helpful: selectedFeedback,
        comment: undefined,
      });
      setShowCommentField(false);
      setFeedbackGiven(true);
    }
  }, [selectedFeedback, origin, setFeedbackGiven]);

  if (!shouldShowFeedbackButton) {
    return null;
  }

  if (feedbackGiven) {
    return (
      <Stack direction="row" alignItems="center" gap={1} width={'100%'}>
        <Icon name="check" color="success" />
        <Text variant="bodySmall" color="success">
          <Trans i18nKey="alerting.ai-feedback.thank-you">Thank you for your feedback!</Trans>
        </Text>
      </Stack>
    );
  }

  if (showCommentField && selectedFeedback !== null) {
    return (
      <Box width={'100%'} padding={2} borderStyle="solid" borderColor={'weak'}>
        <Stack direction="column" gap={2} width={'100%'}>
          <Text variant="body">
            <Trans i18nKey="alerting.ai-feedback.comment-prompt">
              Would you like to tell us more about your experience?
            </Trans>
          </Text>
          <Field
            label={t('alerting.ai-feedback.comment-label', 'Additional feedback (optional)')}
            description={t(
              'alerting.ai-feedback.comment-description',
              'Help us improve by sharing what worked well or what could be better'
            )}
            noMargin
          >
            <TextArea
              value={comment}
              onChange={(e) => setComment(e.currentTarget.value)}
              placeholder={t('alerting.ai-feedback.comment-placeholder', 'Share your thoughts on the AI response...')}
              rows={3}
            />
          </Field>
          <Stack direction="row" gap={2} justifyContent="flex-end">
            <Button variant="secondary" size="sm" onClick={handleSkipComment}>
              <Trans i18nKey="alerting.ai-feedback.skip">Skip</Trans>
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmitWithComment}>
              <Trans i18nKey="alerting.ai-feedback.submit">Submit Feedback</Trans>
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Box width={'100%'} padding={2} borderStyle="solid" borderColor={'weak'}>
      <Stack direction="column" gap={2} width={'100%'}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name="ai-sparkle" className={styles.aiSparkle} />
          <Text variant="body" color="info">
            <Trans i18nKey="alerting.ai-feedback.question">Was this AI response helpful?</Trans>
          </Text>
        </Stack>
        <Stack direction="row" gap={2} alignItems="center">
          <Button
            variant="secondary"
            size="sm"
            icon="thumbs-up"
            onClick={() => setSelectedFeedback(true)}
            className={styles.feedbackButton}
          >
            <Trans i18nKey="alerting.ai-feedback.helpful">Yes, helpful</Trans>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedFeedback(false)}
            className={styles.feedbackButton}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <Icon name="thumbs-up" className={styles.thumbsDown} />
              <Trans i18nKey="alerting.ai-feedback.not-helpful">No, not helpful</Trans>
            </Stack>
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

/**
 * Main AI Feedback component - the primary public API.
 * Can work with or without route detection based on useRouteDetection prop.
 * Automatically handles tracking based on the origin type.
 */
export const AIFeedbackComponent = ({
  origin,
  shouldShowFeedbackButton,
  useRouteDetection = true,
}: GenAIFeedbackButtonProps) => {
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  if (useRouteDetection) {
    // Use route detection version
    return (
      <AIFeedbackWithRouteDetection
        origin={origin}
        shouldShowFeedbackButton={shouldShowFeedbackButton}
        feedbackGiven={feedbackGiven}
        setFeedbackGiven={setFeedbackGiven}
      />
    );
  }

  // Use direct version of the component
  return (
    <AIFeedbackWithoutRouteDetection
      shouldShowFeedbackButton={shouldShowFeedbackButton}
      origin={origin}
      feedbackGiven={feedbackGiven}
      setFeedbackGiven={setFeedbackGiven}
    />
  );
};

/**
 * Wrapper component for AlertRuleForm that includes URL parameter detection.
 * Only renders the feedback component if the route was reached from AI and the feature is enabled.
 * Handles tracking internally based on the origin.
 */
export const AIFeedbackWithRouteDetection = ({
  origin,
  shouldShowFeedbackButton,
  feedbackGiven,
  setFeedbackGiven,
}: AIFeedbackWithStateProps) => {
  const [searchParams] = useURLSearchParams();
  const isFromAI = searchParams.get('fromAI') === 'true';

  if (!shouldShowFeedbackButton || !isFromAI) {
    return null;
  }

  return (
    <AIFeedbackWithoutRouteDetection
      shouldShowFeedbackButton={shouldShowFeedbackButton}
      origin={origin}
      feedbackGiven={feedbackGiven}
      setFeedbackGiven={setFeedbackGiven}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  feedbackButton: css({
    minWidth: '120px',
  }),
  thumbsDown: css({
    transform: 'scale(-1, -1)',
  }),
  aiSparkle: css({
    color: theme.colors.info.main,
  }),
});
