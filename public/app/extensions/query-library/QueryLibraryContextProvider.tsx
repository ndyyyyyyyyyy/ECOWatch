import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { CoreApp } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { QueryLibraryContext, QueryLibraryDrawerOptions } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { QueryTemplate, type OnSelectQueryType } from '../../features/explore/QueryLibrary/types';

import { QueryLibraryInteractions } from './QueryLibraryAnalyticsEvents';
import { QueryLibraryDrawer } from './QueryLibraryDrawer';
import { QueryLibraryEditingHeader } from './QueryLibraryEditingHeader';
import { SavedQueryButtons } from './SavedQueryButtons';
import { QueryLibraryEventsPropertyMap } from './types';

import { getQueryLibraryDrawerAction, getQueryLibraryRenderContext } from './index';

export function QueryLibraryContextProvider({ children }: PropsWithChildren) {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeDatasources, setActiveDatasources] = useState<string[]>([]);

  const [newQuery, setNewQuery] = useState<QueryTemplate | undefined>(undefined);
  // Use regular state for the callback
  const [onSelectQuery, setOnSelectQuery] = useState<OnSelectQueryType>(() => () => {});
  const [context, setContext] = useState('unknown');
  const [onSave, setOnSave] = useState<(() => void) | undefined>(undefined);

  // Enhanced drawer options
  const [highlightedQuery, setHighlightedQuery] = useState<string | undefined>(undefined);

  // Auto-clear highlight after 3 seconds
  useEffect(() => {
    if (highlightedQuery) {
      const timer = setTimeout(() => {
        setHighlightedQuery(undefined);
      }, 2000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [highlightedQuery]);

  const triggerAnalyticsEvent = useCallback(
    (
      handleAnalyticEvent: (properties?: QueryLibraryEventsPropertyMap) => void,
      properties?: QueryLibraryEventsPropertyMap,
      contextOverride?: string
    ) => {
      const appContext = contextOverride || context;
      const propertiesWithContext = { app: appContext, ...properties };
      handleAnalyticEvent(propertiesWithContext);
    },
    [context]
  );

  const openDrawer = useCallback(
    ({ datasourceFilters, onSelectQuery, options, query }: QueryLibraryDrawerOptions) => {
      // this means the user is trying to add a query but is a viewer
      if (!!query && contextSrv.hasRole('Viewer')) {
        return;
      }

      setActiveDatasources(datasourceFilters || []);
      setOnSave(() => options?.onSave);
      // Update the callback state
      if (onSelectQuery) {
        setOnSelectQuery(() => onSelectQuery);
      }
      setIsDrawerOpen(true);
      setContext(getQueryLibraryRenderContext(options?.context));
      // Set enhanced options
      setHighlightedQuery(options?.highlightQuery);

      triggerAnalyticsEvent(
        QueryLibraryInteractions.queryLibraryOpened,
        {
          mode: getQueryLibraryDrawerAction({ query, options }),
        },
        options?.context
      );

      if (!!query) {
        setNewQuery({ query });
        triggerAnalyticsEvent(QueryLibraryInteractions.saveQueryToLibraryClicked, undefined, options?.context);
      } else {
        options?.isReplacingQuery
          ? triggerAnalyticsEvent(
              QueryLibraryInteractions.replaceWithQueryFromLibraryClicked,
              undefined,
              options?.context
            )
          : triggerAnalyticsEvent(QueryLibraryInteractions.addQueryFromLibraryClicked, undefined, options?.context);
      }
    },
    [triggerAnalyticsEvent]
  );

  const closeDrawer = useCallback(
    (isSelectingQuery?: boolean, isEditingQuery?: boolean) => {
      setActiveDatasources([]);
      // Reset the callback to no-op function
      setOnSelectQuery(() => () => {});
      setNewQuery(undefined);
      setIsDrawerOpen(false);

      // Clear enhanced options
      setHighlightedQuery(undefined);

      if (isEditingQuery) {
        triggerAnalyticsEvent(QueryLibraryInteractions.queryLibraryClosedToEditQueryInExplore);
      } else if (!isSelectingQuery && !newQuery) {
        triggerAnalyticsEvent(QueryLibraryInteractions.queryLibraryClosedWithoutSelection);
      } else if (newQuery) {
        triggerAnalyticsEvent(QueryLibraryInteractions.queryLibraryClosedWithoutSavingNewQUery);
      }
    },
    [newQuery, triggerAnalyticsEvent]
  );

  const contextVal = useMemo(
    () => ({
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      triggerAnalyticsEvent,
      renderSavedQueryButtons: (
        query: DataQuery,
        app?: CoreApp,
        onUpdateSuccess?: () => void,
        onSelectQuery?: (query: DataQuery) => void,
        datasourceFilters?: string[]
      ) => (
        <SavedQueryButtons
          query={query}
          app={app}
          onUpdateSuccess={onUpdateSuccess}
          onSelectQuery={onSelectQuery}
          datasourceFilters={datasourceFilters || []}
        />
      ),
      renderQueryLibraryEditingHeader: (
        query: DataQuery,
        app?: CoreApp,
        queryLibraryRef?: string,
        onCancelEdit?: () => void,
        onUpdateSuccess?: () => void,
        onSelectQuery?: (query: DataQuery) => void
      ) => (
        <QueryLibraryEditingHeader
          query={query}
          app={app}
          queryLibraryRef={queryLibraryRef}
          onCancelEdit={onCancelEdit}
          onUpdateSuccess={onUpdateSuccess}
          onSelectQuery={onSelectQuery}
        />
      ),
      queryLibraryEnabled: Boolean(config.featureToggles.queryLibrary),
      context,
      setNewQuery,
      onSave,
      onSelectQuery,
    }),
    [isDrawerOpen, openDrawer, closeDrawer, context, setNewQuery, onSave, triggerAnalyticsEvent, onSelectQuery]
  );

  return (
    <QueryLibraryContext.Provider value={contextVal}>
      {children}
      <QueryLibraryDrawer
        isOpen={isDrawerOpen}
        close={() => closeDrawer(false)}
        activeDatasources={activeDatasources}
        highlightedQuery={highlightedQuery}
        newQuery={newQuery}
      />
    </QueryLibraryContext.Provider>
  );
}
