import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, FilterInput, MultiSelect, Stack } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { SortPicker } from '../../../core/components/Select/SortPicker';
import { TagFilter, TermCount } from '../../../core/components/TagFilter/TagFilter';
import { QueryLibraryInteractions } from '../QueryLibraryAnalyticsEvents';
import { getQueryLibrarySortingOptions } from '../QueryLibrarySortingOptions';

export interface QueryLibraryFiltersProps {
  datasourceFilterOptions: Array<SelectableValue<string>>;
  datasourceFilters: Array<SelectableValue<string>>;
  disabled?: boolean;
  onChangeDatasourceFilters: (datasources: Array<SelectableValue<string>>) => void;
  onChangeSearchQuery: (query: string) => void;
  onChangeSortingOption: (option: SelectableValue) => void;
  onChangeUserFilters: (users: Array<SelectableValue<string>>) => void;
  onChangeTagFilters: (tags: string[]) => void;
  searchQuery: string;
  sortingOption?: SelectableValue;
  userFilterOptions: Array<SelectableValue<string>>;
  userFilters: Array<SelectableValue<string>>;
  tagFilters: string[];
  getTagOptions: () => Promise<TermCount[]>;
}

const DATASOURCE_FILTER_ID = 'query-library-datasource-filter';
const USER_FILTER_ID = 'query-library-user-filter';
const TAG_FILTER_ID = 'query-library-tag-filter';

const MIN_FILTER_WIDTH = 30;

export function QueryLibraryFilters({
  datasourceFilterOptions,
  datasourceFilters,
  disabled,
  onChangeDatasourceFilters,
  onChangeSearchQuery,
  onChangeSortingOption,
  onChangeUserFilters,
  onChangeTagFilters,
  searchQuery,
  sortingOption,
  userFilterOptions,
  userFilters,
  tagFilters,
  getTagOptions,
}: QueryLibraryFiltersProps) {
  const { triggerAnalyticsEvent } = useQueryLibraryContext();

  const onTagFilterChange = (tags: string[]) => {
    onChangeTagFilters(tags);
    triggerAnalyticsEvent(QueryLibraryInteractions.tagFilterChanged);
  };

  return (
    <Stack direction="column">
      <Stack direction="row">
        <FilterInput
          disabled={disabled}
          placeholder={t(
            'query-library.filters.search-placeholder',
            'Search by data source, query content, title, or description'
          )}
          aria-label={t(
            'query-library.filters.search-placeholder',
            'Search by data source, query content, title, or description'
          )}
          value={searchQuery}
          onChange={onChangeSearchQuery}
          onFocus={() => triggerAnalyticsEvent(QueryLibraryInteractions.searchBarFocused)}
          escapeRegex={false}
        />
        <Box flex={1}>
          <SortPicker
            onChange={(change) => {
              triggerAnalyticsEvent(QueryLibraryInteractions.sortingOptionChanged, { value: change.value });
              onChangeSortingOption(change);
            }}
            value={sortingOption?.value}
            getSortOptions={getQueryLibrarySortingOptions}
            placeholder={t('query-library.filters.sort-placeholder', 'Sort')}
            disabled={disabled}
          />
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} wrap="wrap">
        <Box flex={1} minWidth={MIN_FILTER_WIDTH}>
          <MultiSelect
            inputId={DATASOURCE_FILTER_ID}
            onChange={(items) => {
              onChangeDatasourceFilters(items);
              triggerAnalyticsEvent(QueryLibraryInteractions.dataSourceFilterChanged);
            }}
            value={datasourceFilters}
            options={datasourceFilterOptions}
            placeholder={t('query-library.filters.datasource-placeholder', 'Filter by data source')}
            aria-label={t('query-library.filters.datasource-placeholder', 'Filter by data source')}
            disabled={disabled}
          />
        </Box>
        <Box flex={1} minWidth={MIN_FILTER_WIDTH}>
          <MultiSelect
            inputId={USER_FILTER_ID}
            onChange={(items) => {
              onChangeUserFilters(items);
              triggerAnalyticsEvent(QueryLibraryInteractions.userFilterChanged);
            }}
            value={userFilters}
            options={userFilterOptions}
            placeholder={t('query-library.filters.datasource-user', 'Filter by user name')}
            aria-label={t('query-library.filters.datasource-user', 'Filter by user name')}
            disabled={disabled}
          />
        </Box>
        <Box flex={1} minWidth={MIN_FILTER_WIDTH}>
          <TagFilter
            isClearable={false}
            tags={tagFilters}
            tagOptions={getTagOptions}
            onChange={onTagFilterChange}
            inputId={TAG_FILTER_ID}
            disabled={disabled}
          />
        </Box>
      </Stack>
    </Stack>
  );
}
