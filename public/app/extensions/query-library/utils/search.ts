import { QueryLibraryTab } from '../QueryLibraryDrawer';
import { QueryTemplateRow } from '../types';

export const searchQueryLibrary = (
  queryLibrary: QueryTemplateRow[],
  query: string,
  dsFilters: string[],
  userNameFilters: string[],
  tagFilters: string[] = [],
  activeTab: QueryLibraryTab,
  userFavorites: { [key: string]: boolean },
  sortingMethod?: (a: QueryTemplateRow, b: QueryTemplateRow) => number
) => {
  const result = queryLibrary.filter((item) => {
    const lowerCaseQuery = query.toLowerCase();
    const lowerCaseDatasourceName = item.datasourceName?.toLowerCase() || '';

    // If the datasource filter is empty, or the item's datasource is in the filter, display the item
    const foundDsFilterMatch =
      dsFilters.length === 0 ||
      dsFilters.some((filter) => {
        const lowerCaseFilter = filter.toLowerCase();
        return lowerCaseDatasourceName.includes(lowerCaseFilter);
      });

    // If the user filter is empty, or the item's user is in the filter, display the item
    const userName = item.user?.displayName || '';
    const foundUserNameFilterMatch = userNameFilters.length === 0 || userNameFilters.includes(userName);

    // If the tag filter is empty, or the item has all the filtered tags, display the item
    const foundTagFilterMatch =
      tagFilters.length === 0 ||
      tagFilters.every((tagFilter) => {
        const tagFilterLowerCase = tagFilter.toLowerCase();
        return item.tags?.some((itemTag) => itemTag.toLowerCase().includes(tagFilterLowerCase));
      });

    // If the query matches any of the fields, display the item
    const queryMatchesDatasourceName = lowerCaseDatasourceName.includes(lowerCaseQuery);
    const queryMatchesDatasourceType = item.datasourceType?.toLowerCase().includes(lowerCaseQuery);
    const queryMatchesTitle = item.title?.toLowerCase().includes(lowerCaseQuery);
    const queryMatchesDescription = item.description?.toLowerCase().includes(lowerCaseQuery);
    const queryMatchesQueryText = item.queryText?.toLowerCase().includes(lowerCaseQuery);
    const queryMatchesTags = item.tags?.some((tag) => tag.toLowerCase().includes(lowerCaseQuery));

    const queryMatchesTabState = activeTab === QueryLibraryTab.ALL || userFavorites[item.uid ?? ''];

    const foundQueryMatch =
      queryMatchesDatasourceName ||
      queryMatchesDatasourceType ||
      queryMatchesTitle ||
      queryMatchesDescription ||
      queryMatchesQueryText ||
      queryMatchesTags;

    return (
      foundQueryMatch && foundDsFilterMatch && foundUserNameFilterMatch && foundTagFilterMatch && queryMatchesTabState
    );
  });

  return result.sort(sortingMethod);
};
