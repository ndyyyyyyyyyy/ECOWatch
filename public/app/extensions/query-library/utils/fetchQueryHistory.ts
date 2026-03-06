import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { getRichHistory, SortOrder, getQueryDisplayText } from 'app/core/utils/richHistory';

import { QueryTemplateRow } from '../types';

const MAX_QUERY_HISTORY_ITEMS = 20;

export const fetchQueryHistory = async (): Promise<QueryTemplateRow[]> => {
  const history = await getRichHistory({
    search: '',
    datasourceFilters: [],
    sortOrder: SortOrder.Descending,
    starred: false,
  });
  const richHistory = history.richHistory.slice(0, Math.min(history.richHistory.length, MAX_QUERY_HISTORY_ITEMS));
  // Convert rich history to query template rows
  const enrichedHistory = await Promise.all(
    richHistory.map(async (item, index) => {
      const datasourceRef = item.queries[0].datasource;
      const datasourceApi = await getDataSourceSrv().get(datasourceRef);
      const description = t('query-library.query-details.recent-description', 'This is one of your recent queries');
      return {
        ...item,
        createdAtTimestamp: item.createdAt,
        datasourceType: datasourceApi?.type,
        datasource: datasourceApi,
        datasourceRef: datasourceRef,
        description,
        title:
          getQueryDisplayText(item.queries[0]) ||
          t('query-library.query-details.recent-example', 'Recent example {{index}}', { index: index + 1 }),
        tags: [],
        isLocked: false,
        isVisible: false,
        query: item.queries[0],
        queryText: datasourceApi?.getQueryDisplayText?.(item.queries[0]),
        uid: item.id,
        index: index.toString(),
        user: {
          uid: 'recent-user-uid',
          displayName: 'recent-user-display-name',
          avatarUrl: 'recent-user-avatar-url',
        },
      };
    })
  );
  return enrichedHistory;
};
