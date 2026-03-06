import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Box, Column, IconButton, InteractiveTable, LinkButton, Stack, Text, IconName, Tooltip } from '@grafana/ui';
import { MetaText } from 'app/features/alerting/unified/components/MetaText';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';

import { AlertEnrichment, EnricherConfig } from '../../api/clients/alertenrichment/v1beta1/endpoints.gen';
import { enrichmentNav } from '../navigation';

import { EnricherTooltip } from './EnricherTooltip';
import { Matchers } from './Matchers';
import {
  trackEnrichmentListView,
  trackEnrichmentLoadMore,
  trackEnrichmentDeleted,
  trackEnrichmentEditClicked,
} from './analytics/Analytics';

interface EnrichmentListProps {
  enrichments: AlertEnrichment[];
  onDelete: (enrichment: AlertEnrichment) => void;
  isLoading?: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

type EnricherConfigType = EnricherConfig['type'];

export function EnrichmentList({
  enrichments,
  onDelete,
  isLoading = false,
  hasMore: hasMore,
  onLoadMore,
}: EnrichmentListProps) {
  // Track list view when component mounts or enrichments change
  useEffect(() => {
    trackEnrichmentListView({
      enrichments_count: enrichments.length,
      has_enrichments: enrichments.length > 0,
    });
  }, [enrichments.length]);

  const handleLoadMore = useCallback(() => {
    trackEnrichmentLoadMore({
      current_count: enrichments.length,
    });
    onLoadMore();
  }, [enrichments.length, onLoadMore]);

  const columns: Array<Column<AlertEnrichment>> = useMemo(() => {
    const handleDelete = (enrichment: AlertEnrichment) => {
      trackEnrichmentDeleted(enrichment);
      onDelete(enrichment);
    };

    const handleEditClick = (enrichment: AlertEnrichment) => {
      trackEnrichmentEditClicked(enrichment);
    };
    return [
      {
        id: 'name',
        header: t('alerting.enrichment.table.enrichment', 'Enrichment'),
        cell: ({ row }) => {
          const enrichment = row.original;
          const spec = enrichment.spec;
          const labelMatchers = spec?.labelMatchers ?? [];
          const annotationMatchers = spec?.annotationMatchers ?? [];
          const enricherType = spec?.steps?.[0]?.enricher?.type;

          const metadata: React.ReactNode[] = [];

          // Add enricher type
          if (enricherType) {
            const enricherConfig = spec?.steps?.[0]?.enricher;

            metadata.push(
              <Tooltip content={<EnricherTooltip enricher={enricherConfig} />}>
                <MetaText icon={getEnricherTypeIcon(enricherType)}>
                  <Text variant="bodySmall" color="secondary">
                    {enricherType}
                  </Text>
                </MetaText>
              </Tooltip>
            );
          }

          if (labelMatchers.length > 0 || annotationMatchers.length > 0) {
            metadata.push(
              <Stack direction="row" gap={1} alignItems="center">
                <MetaText>
                  <Text variant="bodySmall" color="primary">
                    {t('alerting.enrichment.table.annotationMatchers-scoped', 'Scoped by ')}
                  </Text>
                </MetaText>
                {labelMatchers.length > 0 && (
                  <Tooltip content={<Matchers matchers={labelMatchers} />}>
                    <MetaText icon="tag-alt">
                      <Text variant="bodySmall" color="primary">
                        {t('alerting.enrichment.table.labelMatchers', 'Labels')}
                      </Text>
                    </MetaText>
                  </Tooltip>
                )}
                {annotationMatchers.length > 0 && (
                  <Tooltip content={<Matchers matchers={annotationMatchers} />}>
                    <MetaText icon="filter">
                      <Text variant="bodySmall" color="primary">
                        {t('alerting.enrichment.table.annotationMatchers', 'Annotations')}
                      </Text>
                    </MetaText>
                  </Tooltip>
                )}
              </Stack>
            );
          }

          if (isEmpty(labelMatchers) && isEmpty(annotationMatchers)) {
            metadata.push(
              <MetaText icon="globe">
                <Text variant="bodySmall" color="primary">
                  <Trans i18nKey="alerting.enrichment.appliesTo">Applies to all alerts</Trans>
                </Text>
              </MetaText>
            );
          }

          return (
            <Stack direction="column" gap={0}>
              {/* Title */}
              <Stack direction="row" alignItems="center" gap={1}>
                <Text color="primary">{enrichment.spec?.title || enrichment.metadata?.name || '<no title>'}</Text>
              </Stack>

              {/* Description */}
              {enrichment.spec?.description && (
                <Text variant="bodySmall" color="secondary" truncate>
                  {enrichment.spec.description}
                </Text>
              )}

              {/* Metadata */}
              <Stack direction="row" gap={1} alignItems="center">
                {metadata.map((item, index) => (
                  <div key={index}>{item}</div>
                ))}
              </Stack>
            </Stack>
          );
        },
      },
      {
        id: 'actions',
        header: t('alerting.enrichment.table.actions', 'Actions'),
        disableGrow: true,
        cell: ({ row }) => {
          const k8sName = row.original.metadata?.name;
          const enrichment = row.original;

          if (!k8sName) {
            return null;
          }

          return (
            <Box paddingX={2} paddingY={1}>
              <Stack direction="row" gap={2}>
                <LinkButton
                  variant="secondary"
                  icon="pen"
                  href={createRelativeUrl(enrichmentNav.edit(k8sName))}
                  size="sm"
                  fill="text"
                  onClick={() => handleEditClick(enrichment)}
                  aria-label={t('alerting.enrichment.edit-enrichment', 'Edit enrichment {{name}}', {
                    name: row.original.spec?.title || k8sName,
                  })}
                >
                  <Trans i18nKey="alerting.enrichment.edit-button">Edit</Trans>
                </LinkButton>
                <IconButton
                  size="sm"
                  variant="destructive"
                  name="trash-alt"
                  onClick={() => handleDelete(enrichment)}
                  aria-label={t('alerting.enrichment.delete-enrichment', 'Delete enrichment {{name}}', {
                    name: row.original.spec?.title || k8sName,
                  })}
                />
              </Stack>
            </Box>
          );
        },
      },
    ];
  }, [onDelete]);

  if (enrichments.length === 0) {
    return (
      <Text>
        <Trans i18nKey="alerting.enrichment.noEnrichments">No alert enrichments configured</Trans>
      </Text>
    );
  }

  // Load more button for infinite loading
  const LoadMoreButton = () => {
    return (
      <Stack direction="row" gap={1} alignItems="center" justifyContent="center">
        <LinkButton variant="secondary" onClick={handleLoadMore} icon={'angle-down'}>
          <Trans i18nKey="alerting.enrichment.loadMore">Load more</Trans>
        </LinkButton>
      </Stack>
    );
  };

  return (
    <Stack direction="column" gap={2}>
      <InteractiveTable
        columns={columns}
        data={enrichments}
        getRowId={(row) => `enrichment-${row.metadata?.name || ''}`}
        pageSize={0}
      />
      {isLoading && (
        <Text>
          <Trans i18nKey="alerting.enrichment.loading">Loading enrichments...</Trans>
        </Text>
      )}
      {!isLoading && hasMore && <LoadMoreButton />}
    </Stack>
  );
}

const enricherTypeIcon: Record<EnricherConfigType, IconName> = {
  assign: 'tag-alt',
  external: 'external-link-alt',
  dsquery: 'database',
  sift: 'search',
  asserts: 'shield',
  explain: 'comment-alt',
  loop: 'repeat',
};

function getEnricherTypeIcon(enricherType: EnricherConfigType): IconName {
  return enricherTypeIcon[enricherType] || 'cog';
}
