import { Trans } from '@grafana/i18n';
import { Text } from '@grafana/ui';

import { AssertsEnricher } from '../../../api/clients/alertenrichment/v1beta1/endpoints.gen';

interface AssertsEnricherTooltipProps {
  enricher?: AssertsEnricher;
}

export function AssertsEnricherTooltip({ enricher }: AssertsEnricherTooltipProps) {
  if (!enricher) {
    return null;
  }

  return (
    <Text variant="bodySmall">
      <Trans i18nKey="alerting.enrichment.tooltip.asserts">Uses asserts to enrich alerts</Trans>
    </Text>
  );
}
