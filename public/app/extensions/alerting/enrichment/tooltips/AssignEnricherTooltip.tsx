import { Trans } from '@grafana/i18n';
import { Stack, Text, Box } from '@grafana/ui';

import { AssignEnricher } from '../../../api/clients/alertenrichment/v1beta1/endpoints.gen';

interface AssignEnricherTooltipProps {
  enricher?: AssignEnricher;
}

export function AssignEnricherTooltip({ enricher }: AssignEnricherTooltipProps) {
  if (!enricher) {
    return null;
  }

  if (!enricher.annotations) {
    return (
      <Text variant="bodySmall">
        <Trans i18nKey="alerting.enrichment.tooltip.assign.default">Assigns annotations to alerts</Trans>
      </Text>
    );
  }

  if (enricher.annotations.length === 0) {
    return (
      <Text variant="bodySmall">
        <Trans i18nKey="alerting.enrichment.tooltip.assign.title">Assigns annotations to alerts</Trans>
      </Text>
    );
  }

  return (
    <Stack direction="column" gap={0.5}>
      <Stack direction="column" gap={0.25}>
        <Text variant="bodySmall" color="secondary">
          <strong>
            <Trans i18nKey="alerting.enrichment.tooltip.assign.assignments">Annotations:</Trans>
          </strong>
        </Text>
        {enricher.annotations.map((assignment, index) => (
          <Box key={index} paddingLeft={1}>
            <Text variant="bodySmall" color="secondary">
              <strong>{assignment.name}</strong>
              {' → '}
              <em>
                {assignment.value || <Trans i18nKey="alerting.enrichment.tooltip.assign.emptyValue">(empty)</Trans>}
              </em>
            </Text>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
