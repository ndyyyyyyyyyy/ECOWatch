import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { useFormContext, useWatch } from 'react-hook-form';

import {
  CoreApp,
  DataSourceInstanceSettings,
  getDefaultRelativeTimeRange,
  getNextRefId,
  rangeUtil,
  LoadingState,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, Stack, Text, Box, Alert } from '@grafana/ui';
import { getDefaultOrFirstCompatibleDataSource } from 'app/features/alerting/unified/utils/datasource';
import { QueryEditorRow } from 'app/features/query/components/QueryEditorRow';

import { AlertEnrichmentFormData } from './form';

interface EnricherConfigProps {
  stepPath: `steps.${number}`;
}

export function QueryEnricherConfig({ stepPath }: EnricherConfigProps) {
  const { setValue, control } = useFormContext<AlertEnrichmentFormData>();

  const queries = useWatch({ control, name: `${stepPath}.enricher.dataSource.raw.request.queries` }) || [];

  const handleAddQuery = () => {
    const defaultDataSource = getDefaultOrFirstCompatibleDataSource();
    const newQuery: DataQuery = {
      refId: getNextRefId(queries),
      datasource: defaultDataSource ? { uid: defaultDataSource.uid, type: defaultDataSource.type } : undefined,
    };

    const updatedQueries = [...queries, newQuery];
    setValue(`${stepPath}.enricher.dataSource.raw.request.queries`, updatedQueries);
  };

  const handleRemoveQuery = ({ refId }: { refId: string }) => {
    const updatedQueries = queries.filter((q: DataQuery) => q.refId !== refId);
    setValue(`${stepPath}.enricher.dataSource.raw.request.queries`, updatedQueries);
  };

  const handleQueryChange = (updatedQuery: DataQuery, index: number) => {
    const updatedQueries = [...queries];
    updatedQueries[index] = updatedQuery;
    setValue(`${stepPath}.enricher.dataSource.raw.request.queries`, updatedQueries);
  };

  const handleDataSourceChange = (dsSettings: DataSourceInstanceSettings, index: number) => {
    const updatedQueries = [...queries];
    updatedQueries[index] = {
      ...updatedQueries[index],
      datasource: { uid: dsSettings.uid, type: dsSettings.type },
    };
    setValue(`${stepPath}.enricher.dataSource.raw.request.queries`, updatedQueries);
  };

  const getDataSourceSettings = (query: DataQuery): DataSourceInstanceSettings | undefined => {
    if (query.datasource?.uid) {
      const dataSourceSrv = getDataSourceSrv();
      const dsSettings = dataSourceSrv.getInstanceSettings(query.datasource.uid);
      if (dsSettings) {
        return dsSettings;
      }
    }
    return undefined;
  };

  return (
    <Stack direction="column" gap={2}>
      <Text variant="bodySmall" color="secondary">
        <Trans
          i18nKey="alert-enrichment-form.dsquery-enricher.raw-queries-description"
          defaults="Define queries that will be executed to enrich your alerts. The results will be available in the enrichment context."
        />
      </Text>

      {queries.length === 0 ? (
        <Stack direction="column" gap={2} alignItems="center">
          <Text color="secondary">
            <Trans i18nKey="alert-enrichment-form.dsquery-enricher.no-queries" defaults="No queries defined yet" />
          </Text>
          <Button onClick={handleAddQuery} variant="secondary" size="sm">
            <Trans i18nKey="alert-enrichment-form.dsquery-enricher.add-first-query" defaults="Add your first query" />
          </Button>
        </Stack>
      ) : (
        <Box borderStyle="solid" borderColor="weak" borderRadius="default" padding={1} backgroundColor="primary">
          <DragDropContext onDragEnd={() => {}}>
            <Droppable droppableId="enrichment-queries" direction="vertical">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  <Stack direction="column" gap={1}>
                    {queries.map((query: DataQuery, index: number) => {
                      const dsSettings = getDataSourceSettings(query);
                      const range = rangeUtil.relativeToTimeRange(getDefaultRelativeTimeRange());

                      if (!dsSettings) {
                        return (
                          <Alert
                            severity="error"
                            title={t('alert-enrichment-form.dsquery-enricher.no-datasource', 'Datasource is missing')}
                            key={query.refId}
                          >
                            <Trans
                              i18nKey="alert-enrichment-form.dsquery-enricher.no-datasource-description"
                              defaults="We couldn't find a datasource for this query. The datasource has been removed or is not available"
                            />
                            <Button
                              onClick={() => handleRemoveQuery(query)}
                              variant="secondary"
                              size="sm"
                              icon="trash-alt"
                            >
                              <Trans
                                i18nKey="alert-enrichment-form.dsquery-enricher.remove-query"
                                defaults="Remove query"
                              />
                            </Button>
                          </Alert>
                        );
                      }

                      return (
                        <QueryEditorRow
                          key={query.refId}
                          id={query.refId}
                          index={index}
                          data={{ state: LoadingState.Done, series: [], timeRange: range }}
                          query={query}
                          queries={queries}
                          dataSource={dsSettings}
                          onChangeDataSource={(settings) => handleDataSourceChange(settings, index)}
                          onChange={(updatedQuery) => handleQueryChange(updatedQuery, index)}
                          onRemoveQuery={handleRemoveQuery}
                          onAddQuery={handleAddQuery}
                          onRunQuery={() => {}} // Not needed for enrichment config
                          range={range}
                          app={CoreApp.UnifiedAlerting}
                          collapsable={false}
                          hideHideQueryButton={true}
                        />
                      );
                    })}
                    {provided.placeholder}

                    <Button onClick={handleAddQuery} variant="secondary" size="sm" icon="plus">
                      <Trans i18nKey="alert-enrichment-form.dsquery-enricher.add-query" defaults="Add query" />
                    </Button>
                  </Stack>
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </Box>
      )}
    </Stack>
  );
}
