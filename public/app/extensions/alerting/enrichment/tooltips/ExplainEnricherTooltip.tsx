import { Trans } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

import { ExplainEnricher } from '../../../api/clients/alertenrichment/v1beta1/endpoints.gen';

interface ExplainEnricherTooltipProps {
  enricher?: ExplainEnricher;
}

export function ExplainEnricherTooltip({ enricher }: ExplainEnricherTooltipProps) {
  if (!enricher) {
    return null;
  }

  if (!enricher.annotation) {
    return (
      <Text variant="bodySmall">
        <Trans i18nKey="alerting.enrichment.tooltip.explain.default">Uses LLM to generate alert explanations</Trans>
      </Text>
    );
  }

  return (
    <Stack direction="column" gap={0.5}>
      <Text variant="bodySmall">
        <Trans i18nKey="alerting.enrichment.tooltip.explain.title">Uses LLM to generate alert explanations</Trans>
      </Text>
      <Text variant="bodySmall" color="secondary">
        <strong>
          <Trans i18nKey="alerting.enrichment.tooltip.explain.annotation">Stores in:</Trans>{' '}
        </strong>
        {enricher.annotation}
      </Text>
    </Stack>
  );
}
