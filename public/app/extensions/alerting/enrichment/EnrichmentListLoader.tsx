import { useState, useCallback } from 'react';
import { useEffectOnce } from 'react-use';

import { t, Trans } from '@grafana/i18n';
import { LinkButton, Stack, Text, ConfirmModal } from '@grafana/ui';
import { logError } from 'app/features/alerting/unified/Analytics';
import { AlertingPageWrapper } from 'app/features/alerting/unified/components/AlertingPageWrapper';
import { useAsync } from 'app/features/alerting/unified/hooks/useAsync';
import { useSettingsPageNav } from 'app/features/alerting/unified/settings/navigation';

import {
  useDeleteAlertEnrichmentMutation,
  useLazyListAlertEnrichmentQuery,
} from '../../api/clients/alertenrichment/v1beta1';
import { AlertEnrichment } from '../../api/clients/alertenrichment/v1beta1/endpoints.gen';

import { EnrichmentList } from './EnrichmentsList';

// The API pagination is currently broken so we try to fetch everything in one request
const API_PAGE_SIZE = 1000;

function EnrichmentListLoader() {
  const { pageNav, navId } = useSettingsPageNav();

  const [enrichmentToDelete, setEnrichmentToDelete] = useState<AlertEnrichment | null>(null);

  const { enrichments, isLoading, isFetching, hasNextPage, loadNextPage, deleteEnrichment } = useEnrichmentList();

  const handleDelete = useCallback((enrichment: AlertEnrichment) => {
    setEnrichmentToDelete(enrichment);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (enrichmentToDelete?.metadata?.name) {
      await deleteEnrichment({ k8sName: enrichmentToDelete.metadata.name });
      setEnrichmentToDelete(null);
    } else {
      logError(new Error('No enrichment to delete', { cause: 'Enrichment has no metadata.name defined' }));
    }
  }, [deleteEnrichment, enrichmentToDelete]);

  const handleCancelDelete = useCallback(() => {
    setEnrichmentToDelete(null);
  }, []);

  return (
    <AlertingPageWrapper pageNav={pageNav} navId={navId} isLoading={isLoading}>
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={2} justifyContent="space-between">
          <Text color="secondary">
            <Trans i18nKey="alerting.enrichment.tab.description">
              Make your alert notifications more actionable by running preliminary analysis and adding more context.
            </Trans>
          </Text>
          <LinkButton variant="primary" href="/alerting/admin/enrichment/new" icon="plus" size="md">
            <Trans i18nKey="alerting.enrichment.new-alert">New alert enrichment</Trans>
          </LinkButton>
        </Stack>
        <EnrichmentList
          enrichments={enrichments}
          onDelete={handleDelete}
          isLoading={isFetching}
          hasMore={hasNextPage}
          onLoadMore={loadNextPage}
        />
      </Stack>

      {enrichmentToDelete && (
        <ConfirmModal
          isOpen={!!enrichmentToDelete}
          title={t('alerting.enrichment.delete.title', 'Delete alert enrichment')}
          body={
            <Trans
              i18nKey="alerting.enrichment.delete.body"
              values={{ name: enrichmentToDelete.spec?.title || enrichmentToDelete.metadata?.name }}
            >
              Are you sure you want to delete the alert enrichment <strong>{'{{name}}'}</strong>?
            </Trans>
          }
          confirmText={t('alerting.enrichment.delete.confirm', 'Delete')}
          dismissText={t('alerting.enrichment.delete.cancel', 'Cancel')}
          icon="trash-alt"
          onConfirm={handleConfirmDelete}
          onDismiss={handleCancelDelete}
        />
      )}
    </AlertingPageWrapper>
  );
}

function useEnrichmentList() {
  const [continueToken, setContinueToken] = useState<string | undefined>();
  const [enrichments, setEnrichments] = useState<AlertEnrichment[]>([]);

  const [triggerQuery, { isLoading, isFetching }] = useLazyListAlertEnrichmentQuery();
  const [deleteEnrichmentMutation] = useDeleteAlertEnrichmentMutation();

  const [loadNextPageActions] = useAsync(async (continueToken?: string) => {
    const response = await triggerQuery({ limit: API_PAGE_SIZE, continue: continueToken }).unwrap();

    if (response?.items) {
      setEnrichments((prev) => [...prev, ...(response.items || [])]);
      setContinueToken(response.metadata?.continue);
    }
  });

  useEffectOnce(() => {
    loadNextPageActions.execute();
  }); // Only run on mount

  const loadNextPage = useCallback(() => {
    loadNextPageActions.execute(continueToken);
  }, [loadNextPageActions, continueToken]);

  const deleteEnrichment = useCallback(
    async ({ k8sName }: { k8sName: string }) => {
      // When deleteing an enrichment we need to reset the list because continue tokens will change after deletion
      await deleteEnrichmentMutation({ name: k8sName });
      setEnrichments([]);
      setContinueToken(undefined);
      loadNextPageActions.execute();
    },
    [deleteEnrichmentMutation, loadNextPageActions]
  );

  const hasNextPage = Boolean(continueToken);

  return {
    enrichments,
    isLoading,
    isFetching,
    hasNextPage,
    loadNextPage,
    deleteEnrichment,
  };
}

export default EnrichmentListLoader;
