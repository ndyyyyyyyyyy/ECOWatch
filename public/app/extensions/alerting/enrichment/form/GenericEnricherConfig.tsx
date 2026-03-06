import { capitalize } from 'lodash';

import { Trans } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

interface GenericEnricherConfigProps {
  enricherType: 'asserts' | 'sift';
  stepPath: `steps.${number}`;
}

export function GenericEnricherConfig({ enricherType }: GenericEnricherConfigProps) {
  return (
    <Stack direction="column" gap={2}>
      <Text variant="body" color="info">
        <Trans
          i18nKey={`alert-enrichment-form.${enricherType}-enricher.description`}
          defaults="{{enricherType}} enricher does not require any configuration. It will start enriching alerts as soon as it is enabled."
          values={{ enricherType: capitalize(enricherType) }}
        />
      </Text>
    </Stack>
  );
}
