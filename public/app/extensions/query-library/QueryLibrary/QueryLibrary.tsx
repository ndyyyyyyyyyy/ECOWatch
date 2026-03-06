import { uniqBy } from 'lodash';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { useAsync } from 'react-use';

import { AppEvents, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Box, Divider, EmptyState, Stack } from '@grafana/ui';
import { useListQueryQuery } from 'app/extensions/api/clients/queries/v1beta1';

import { TermCount } from '../../../core/components/TagFilter/TagFilter';
import { QueryTemplate as QueryTemplateType } from '../../../features/explore/QueryLibrary/types';
import { QueryLibraryTab } from '../QueryLibraryDrawer';
import { newestSortingOption } from '../QueryLibrarySortingOptions';
import { selectors } from '../e2e-selectors/selectors';
import { useLoadQueryMetadata, useLoadUsers, useGetNewQuery } from '../utils/dataFetching';
import { fetchQueryHistory } from '../utils/fetchQueryHistory';
import { convertDataQueryResponseToQueryTemplates, convertToMapTagCount } from '../utils/mappers';
import { searchQueryLibrary } from '../utils/search';
import { QueryTemplate } from '../utils/types';

import { QueryLibraryContent } from './QueryLibraryContent';
import { QueryLibraryFilters } from './QueryLibraryFilters';

export interface QueryLibraryProps {
  // list of active datasources to filter the query library by
  activeDatasources: string[];
  activeTab: QueryLibraryTab;
  userFavorites: { [key: string]: boolean };
  onFavorite: (uid: string) => void;
  onUnfavorite: (uid: string) => void;
  // Enhanced options (currently unused, reserved for future implementation of overriding query library from explore)
  highlightedQuery?: string;
  // New query to be added to the library.
  newQuery?: QueryTemplateType;
}

export function QueryLibrary({
  activeDatasources,
  activeTab,
  userFavorites,
  onFavorite,
  onUnfavorite,
  highlightedQuery,
  newQuery: query,
}: QueryLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [datasourceFilters, setDatasourceFilters] = useState<Array<SelectableValue<string>>>(
    activeDatasources.map((ds) => ({ value: ds, label: ds }))
  );
  const [userFilters, setUserFilters] = useState<Array<SelectableValue<string>>>([]);
  const [sortingOption, setSortingOption] = useState<SelectableValue | undefined>(newestSortingOption());
  const [tagFilters, setTagFilters] = useState<string[]>([]);

  const {
    data: rawData,
    isLoading: isQueryTemplatesLoading,
    error,
  } = useListQueryQuery({}, { refetchOnMountOrArgChange: true });

  const data = useMemo(() => (rawData ? convertDataQueryResponseToQueryTemplates(rawData) : undefined), [rawData]);
  const loadUsersResult = useLoadUsersWithError(data);
  const userNames = loadUsersResult.data ? loadUsersResult.data.display.map((user) => user.displayName) : [];

  const loadQueryMetadataResult = useLoadQueryMetadataWithError(data, loadUsersResult.data);

  // Filtering right now is done just on the frontend until there is better backend support for this.
  const filteredRows = useMemo(
    () =>
      loadQueryMetadataResult.value
        ? searchQueryLibrary(
            loadQueryMetadataResult.value,
            searchQuery,
            datasourceFilters.map((f) => f.value || ''),
            userFilters.map((f) => f.value || ''),
            tagFilters,
            activeTab,
            userFavorites,
            sortingOption?.sort
          )
        : [],
    [
      loadQueryMetadataResult.value,
      searchQuery,
      datasourceFilters,
      userFilters,
      tagFilters,
      sortingOption,
      activeTab,
      userFavorites,
    ]
  );

  const queryHistory = useAsync(async () => {
    return await fetchQueryHistory();
  }, []);

  const { data: newQuery, isLoading: isNewQueryLoading, isError: isNewQueryError } = useGetNewQuery(query);

  // Adds the new query datasource to the active datasource filters if it's not already.
  useEffect(() => {
    if (newQuery?.datasourceName && !datasourceFilters.some((ds) => ds.value === newQuery.datasourceName)) {
      setDatasourceFilters([...datasourceFilters, { value: newQuery.datasourceName, label: newQuery.datasourceName }]);
    }
  }, [newQuery, datasourceFilters, setDatasourceFilters]);

  const isFiltered = Boolean(
    searchQuery || datasourceFilters.length > 0 || userFilters.length > 0 || tagFilters.length > 0
  );

  const isLoading =
    isQueryTemplatesLoading ||
    loadUsersResult.isLoading ||
    loadQueryMetadataResult.loading ||
    typeof filteredRows === 'undefined' ||
    (loadQueryMetadataResult.loading && !filteredRows.length);
  const datasourceNames = useMemo(() => {
    return uniqBy(loadQueryMetadataResult.value, 'datasourceName').map((row) => row.datasourceName);
  }, [loadQueryMetadataResult.value]);

  const getTagOptions = useCallback(async (): Promise<TermCount[]> => {
    return convertToMapTagCount(loadQueryMetadataResult);
  }, [loadQueryMetadataResult]);

  let libraryRows = filteredRows;
  let usingHistory = false;
  if (activeTab === QueryLibraryTab.RECENT) {
    libraryRows = queryHistory.value || [];
    usingHistory = true;
  }

  const libraryContent = useMemo(() => {
    if ((isLoading && !newQuery) || isNewQueryLoading) {
      return <QueryLibraryContent.Skeleton skeletonDetails />;
    } else {
      return (
        <QueryLibraryContent
          isFiltered={isFiltered}
          usingHistory={usingHistory}
          queryRows={libraryRows || []}
          userFavorites={userFavorites}
          onFavorite={onFavorite}
          onUnfavorite={onUnfavorite}
          highlightedQuery={highlightedQuery}
          newQuery={newQuery}
          activeTab={activeTab}
          isLoading={isLoading}
        />
      );
    }
  }, [
    libraryRows,
    isLoading,
    isFiltered,
    onFavorite,
    onUnfavorite,
    userFavorites,
    highlightedQuery,
    usingHistory,
    newQuery,
    isNewQueryLoading,
    activeTab,
  ]);

  if (error || isNewQueryError) {
    return (
      <EmptyState variant="not-found" message={t('query-library.error-state.title', 'Something went wrong!')}>
        {error instanceof Error ? error.message : ''}
      </EmptyState>
    );
  }

  const showFilters = activeTab !== QueryLibraryTab.RECENT;

  return (
    <Stack data-testid={selectors.components.queryLibraryDrawer.content} height="100%" direction="column" gap={0}>
      {showFilters && (
        <Box backgroundColor="primary" paddingBottom={2}>
          <QueryLibraryFilters
            datasourceFilterOptions={datasourceNames.map((r) => ({
              value: r,
              label: r,
            }))}
            datasourceFilters={datasourceFilters}
            disabled={isLoading || !!newQuery}
            onChangeDatasourceFilters={setDatasourceFilters}
            onChangeSearchQuery={setSearchQuery}
            onChangeSortingOption={setSortingOption}
            onChangeUserFilters={setUserFilters}
            onChangeTagFilters={setTagFilters}
            searchQuery={searchQuery}
            sortingOption={sortingOption}
            userFilterOptions={userNames.map((r: string) => ({
              value: r,
              label: r,
            }))}
            userFilters={userFilters}
            tagFilters={tagFilters}
            getTagOptions={getTagOptions}
          />
        </Box>
      )}
      {showFilters && <Divider spacing={0} />}
      <Stack direction="column" flex={1} minHeight={0}>
        {libraryContent}
      </Stack>
    </Stack>
  );
}

/**
 * Wrap useLoadUsers with error handling.
 * @param data
 */
function useLoadUsersWithError(data: QueryTemplate[] | undefined) {
  const userUIDs = useMemo(() => data?.map((qt) => qt.user?.uid).filter((uid) => uid !== undefined), [data]);
  const loadUsersResult = useLoadUsers(userUIDs);

  useEffect(() => {
    if (loadUsersResult.error) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: [
          t('query-library.user-info.error', 'Error attempting to get user info from the library: {{error}}', {
            error: JSON.stringify(loadUsersResult.error),
          }),
        ],
      });
    }
  }, [loadUsersResult.error]);
  return loadUsersResult;
}

/**
 * Wrap useLoadQueryMetadata with error handling.
 * @param queryTemplates
 * @param userDataList
 */
function useLoadQueryMetadataWithError(
  queryTemplates: QueryTemplate[] | undefined,
  userDataList: ReturnType<typeof useLoadUsers>['data']
) {
  const result = useLoadQueryMetadata(queryTemplates, userDataList);

  // useLoadQueryMetadata returns errors in the values so we filter and group them and later alert only one time for
  // all the errors. This way we show data that is loaded even if some rows errored out.
  // TODO: maybe we could show the rows with incomplete data to see exactly which ones errored out. I assume this
  //  can happen for example when data source for saved query was deleted. Would be nice if user would still be able
  //  to delete such row or decide what to do.
  const [values] = useMemo(() => {
    let errors: Error[] = [];
    let values = [];
    if (!result.value) {
      return [undefined, errors];
    } else if (!result.loading) {
      for (const value of result.value!) {
        if (value.error) {
          errors.push(value.error);
        } else {
          values.push(value);
        }
      }
    }
    return [values];
  }, [result]);

  // TODO: related to the TODO comment above, this is a temporary solution since we don't have a way to filter these queries
  //   in the backend yet

  // useEffect(() => {
  //   if (errors.length) {
  //     getAppEvents().publish({
  //       type: AppEvents.alertError.name,
  //       payload: [
  //         t('query-library.query-template.error', 'Error attempting to load query template metadata: {{error}}', {
  //           error: JSON.stringify(errors),
  //         }),
  //       ],
  //     });
  //   }
  // }, [errors]);

  return {
    loading: result.loading,
    value: values,
  };
}
