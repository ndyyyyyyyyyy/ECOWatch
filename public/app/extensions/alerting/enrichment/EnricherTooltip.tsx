import { Trans } from '@grafana/i18n';
import { Text } from '@grafana/ui';

import { EnricherConfig } from '../../api/clients/alertenrichment/v1beta1/endpoints.gen';

import { AssertsEnricherTooltip } from './tooltips/AssertsEnricherTooltip';
import { AssignEnricherTooltip } from './tooltips/AssignEnricherTooltip';
import { DsqueryEnricherTooltip } from './tooltips/DsqueryEnricherTooltip';
import { ExplainEnricherTooltip } from './tooltips/ExplainEnricherTooltip';
import { ExternalEnricherTooltip } from './tooltips/ExternalEnricherTooltip';
import { SiftEnricherTooltip } from './tooltips/SiftEnricherTooltip';

interface EnricherTooltipProps {
  enricher?: EnricherConfig;
}

export function EnricherTooltip({ enricher }: EnricherTooltipProps) {
  if (!enricher) {
    return null;
  }

  const { type } = enricher;

  switch (type) {
    case 'assign':
      return <AssignEnricherTooltip enricher={enricher.assign} />;

    case 'external':
      return <ExternalEnricherTooltip enricher={enricher.external} />;

    case 'dsquery':
      return <DsqueryEnricherTooltip enricher={enricher.dataSource} />;

    case 'explain':
      return <ExplainEnricherTooltip enricher={enricher.explain} />;

    case 'sift':
      return <SiftEnricherTooltip enricher={enricher.sift} />;

    case 'asserts':
      return <AssertsEnricherTooltip enricher={enricher.asserts} />;

    default:
      return (
        <Text variant="bodySmall">
          <Trans i18nKey="alerting.enrichment.tooltip.default">Alert enrichment configured</Trans>
        </Text>
      );
  }
}
