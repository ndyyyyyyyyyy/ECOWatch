import { Trans } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Stack, Text, Box } from '@grafana/ui';

import { DataSourceEnricher } from '../../../api/clients/alertenrichment/v1beta1/endpoints.gen';

interface DsqueryEnricherTooltipProps {
  enricher?: DataSourceEnricher;
}

export function DsqueryEnricherTooltip({ enricher }: DsqueryEnricherTooltipProps) {
  if (!enricher) {
    return null;
  }

  const { logs, raw } = enricher;
  const dsType = logs ? 'logs' : raw ? 'raw' : 'unknown';

  return (
    <Stack direction="column" gap={0.5}>
      <Text variant="bodySmall">
        <Trans i18nKey="alerting.enrichment.tooltip.dsquery.title">Data source queries for enrichment</Trans>
      </Text>
      <Text variant="bodySmall" color="secondary">
        <strong>
          <Trans i18nKey="alerting.enrichment.tooltip.dsquery.type">Type:</Trans>{' '}
        </strong>
        {dsType}
      </Text>

      {/* Logs type specific information */}
      {dsType === 'logs' && logs && (
        <>
          {logs.dataSourceType && (
            <Text variant="bodySmall" color="secondary">
              <strong>
                <Trans i18nKey="alerting.enrichment.tooltip.dsquery.datasourceType">Datasource:</Trans>{' '}
              </strong>
              {logs.dataSourceType}
            </Text>
          )}
          {logs.expr && (
            <Text variant="bodySmall" color="secondary">
              <strong>
                <Trans i18nKey="alerting.enrichment.tooltip.dsquery.query">Query:</Trans>{' '}
              </strong>
              {logs.expr}
            </Text>
          )}
          {logs.maxLines && (
            <Text variant="bodySmall" color="secondary">
              <strong>
                <Trans i18nKey="alerting.enrichment.tooltip.dsquery.maxLines">Max lines:</Trans>{' '}
              </strong>
              {logs.maxLines}
            </Text>
          )}
        </>
      )}

      {/* Raw type specific information */}
      {dsType === 'raw' && raw && (
        <>
          {raw.request?.queries && raw.request.queries.length > 0 ? (
            <Stack direction="column" gap={0.25}>
              <Text variant="bodySmall" color="secondary">
                <strong>
                  <Trans i18nKey="alerting.enrichment.tooltip.dsquery.queries">Queries:</Trans>
                </strong>
              </Text>
              {raw.request.queries.map((query: DataQuery & Record<string, any>, index: number) => (
                <Box key={query.refId || index} paddingLeft={1}>
                  <Text variant="bodySmall" color="secondary">
                    <strong>{query.refId || `Query ${index + 1}`}</strong>
                    {query.datasource?.type && <span> ({query.datasource.type})</span>}
                  </Text>
                  {/* Show query expression if it exists */}
                  {(query.expr || query.query) && (
                    <Text variant="bodySmall" color="secondary">
                      <code>{query.expr || query.query}</code>
                    </Text>
                  )}
                </Box>
              ))}
            </Stack>
          ) : (
            <>
              {raw.refId && (
                <Text variant="bodySmall" color="secondary">
                  <strong>
                    <Trans i18nKey="alerting.enrichment.tooltip.dsquery.refId">Ref ID:</Trans>{' '}
                  </strong>
                  {raw.refId}
                </Text>
              )}
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="alerting.enrichment.tooltip.dsquery.rawRequest">
                  Custom data source request configured
                </Trans>
              </Text>
            </>
          )}
        </>
      )}
    </Stack>
  );
}
