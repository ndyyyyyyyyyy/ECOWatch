import { useMemo } from 'react';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';

import { enrichmentNav } from '../navigation';

export function useEditEnrichmentNavModel(enrichmentK8sName?: string): NavModelItem {
  return useMemo(
    () => ({
      text: t('alerting.enrichment.edit-title', 'Edit enrichment'),
      icon: 'edit',
      url: enrichmentK8sName ? createRelativeUrl(enrichmentNav.edit(enrichmentK8sName)) : '#',
      parentItem: getEnrichmentListNavModel(),
    }),
    [enrichmentK8sName]
  );
}

export function useNewEnrichmentNavModel(): NavModelItem {
  return useMemo(
    () => ({
      text: t('alerting.enrichment.new-title', 'New enrichment'),
      icon: 'plus',
      url: createRelativeUrl(enrichmentNav.new),
      parentItem: getEnrichmentListNavModel(),
    }),
    []
  );
}

function getEnrichmentListNavModel(): NavModelItem {
  return {
    text: t('alerting.enrichment.enrichments', 'Enrichments'),
    icon: 'list-ul',
    url: createRelativeUrl(enrichmentNav.list),
  };
}
