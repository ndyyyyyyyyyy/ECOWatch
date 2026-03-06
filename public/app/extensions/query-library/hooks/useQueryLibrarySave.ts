import { CoreApp } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { QuerySpec, useUpdateQueryMutation } from 'app/extensions/api/clients/queries/v1beta1';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { QueryLibraryInteractions } from '../QueryLibraryAnalyticsEvents';

export const useQueryLibrarySave = () => {
  const { queryLibraryEnabled, openDrawer, triggerAnalyticsEvent } = useQueryLibraryContext();
  const [updateQueryTemplate] = useUpdateQueryMutation();

  const saveNewQuery = async (
    query: DataQuery,
    onSelectQuery?: (query: DataQuery) => void,
    options?: { context?: CoreApp }
  ) => {
    if (!queryLibraryEnabled) {
      return;
    }
    return openDrawer({ onSelectQuery, options, query });
  };

  const updateQuery = async (
    query: DataQuery,
    options?: {
      context?: CoreApp;
      queryLibraryRef?: string;
    },
    onUpdateSuccess?: () => void,
    onSelectQuery?: (query: DataQuery) => void
  ) => {
    const { context: app, queryLibraryRef } = options || {};
    if (!queryLibraryRef || !query || !query.datasource?.type) {
      console.error('Invalid query update attempt:', {
        queryLibraryRef: !!queryLibraryRef,
        query: !!query,
        datasourceType: query?.datasource?.type,
      });
      return;
    }
    const targetQuery: QuerySpec = {
      targets: [
        {
          properties: {
            ...query,
            datasource: {
              ...query.datasource,
              type: query.datasource?.type,
            },
          },
          variables: {},
        },
      ],
    };

    try {
      await updateQueryTemplate({
        name: queryLibraryRef,
        patch: {
          spec: {
            targets: targetQuery.targets,
          },
        },
      }).unwrap();

      // Track successful update
      triggerAnalyticsEvent(QueryLibraryInteractions.updateQueryFromExploreCompleted, {
        datasourceType: query.datasource?.type,
      });

      // Call the success callback to clear queryLibraryRef
      onUpdateSuccess?.();

      // Open drawer with the updated query highlighted
      openDrawer({
        datasourceFilters: [],
        onSelectQuery,
        options: {
          context: app || 'unknown',
          highlightQuery: queryLibraryRef,
        },
      });
    } catch (error) {
      // Error is already handled by the global error system
      console.error('Failed to update query in library:', error);
    }
  };

  const isEnabled = () => {
    return queryLibraryEnabled;
  };

  return {
    saveNewQuery,
    updateQuery,
    isEnabled,
  };
};
