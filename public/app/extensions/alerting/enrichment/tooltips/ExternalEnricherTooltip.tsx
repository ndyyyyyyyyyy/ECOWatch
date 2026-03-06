import { Trans } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

import { ExternalEnricher } from '../../../api/clients/alertenrichment/v1beta1/endpoints.gen';

interface ExternalEnricherTooltipProps {
  enricher?: ExternalEnricher;
}

export function ExternalEnricherTooltip({ enricher }: ExternalEnricherTooltipProps) {
  if (!enricher) {
    return null;
  }

  if (!enricher.url) {
    return (
      <Text variant="bodySmall">
        <Trans i18nKey="alerting.enrichment.tooltip.external.default">Calls external service for enrichment</Trans>
      </Text>
    );
  }

  return (
    <Stack direction="column" gap={0.5}>
      <Text variant="bodySmall">
        <Trans i18nKey="alerting.enrichment.tooltip.external.title">Calls external service for enrichment</Trans>
      </Text>
      <Text variant="bodySmall" color="secondary">
        <strong>
          <Trans i18nKey="alerting.enrichment.tooltip.external.url">URL:</Trans>{' '}
        </strong>
        {enricher.url}
      </Text>
    </Stack>
  );
}
