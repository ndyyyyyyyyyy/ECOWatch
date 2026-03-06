import { Trans } from '@grafana/i18n';
import { Text } from '@grafana/ui';

import { SiftEnricher } from '../../../api/clients/alertenrichment/v1beta1/endpoints.gen';

interface SiftEnricherTooltipProps {
  enricher?: SiftEnricher;
}

export function SiftEnricherTooltip({ enricher }: SiftEnricherTooltipProps) {
  if (!enricher) {
    return null;
  }

  return (
    <Text variant="bodySmall">
      <Trans i18nKey="alerting.enrichment.tooltip.sift">Uses sift to enrich alerts</Trans>
    </Text>
  );
}
