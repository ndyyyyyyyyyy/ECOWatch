import { reportInteraction } from '@grafana/runtime';

const queryLibraryInteraction = (event: string, properties?: Record<string, unknown>) => {
  reportInteraction(`query_library-${event}`, properties);
};

export interface QueryLibraryEventsPropertyMap {
  [key: string]: string | boolean | undefined;
}

export const QueryLibraryInteractions: Record<string, (properties?: QueryLibraryEventsPropertyMap) => void> = {
  queryLibraryOpened: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('opened', properties);
  },
  queryLibraryClosedWithoutSelection: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('closed_without_selection', properties);
  },
  queryLibraryClosedWithoutSavingNewQUery: () => {
    queryLibraryInteraction('closed_without_saving_new_query');
  },
  // Outside Interactions
  addQueryFromLibraryClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('add_query_from_library_clicked', properties);
  },
  replaceWithQueryFromLibraryClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('replace_with_query_from_library_clicked', properties);
  },
  saveQueryToLibraryClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('save_query_to_library_clicked', properties);
  },
  // Creating new query
  cancelSaveNewQueryClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('cancel_save_new_query_clicked', properties);
  },
  saveQuerySuccess: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('save_query_success', properties);
  },
  editInExploreClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('edit_in_explore_clicked', properties);
  },
  updateQueryFromExploreCompleted: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('update_query_from_explore_completed', properties);
  },

  // Inside Interactions
  // Filter
  searchBarFocused: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('search_bar_focused', properties);
  },
  dataSourceFilterChanged: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('data_source_filter_changed', properties);
  },
  userFilterChanged: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('user_filter_changed', properties);
  },
  sortingOptionChanged: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('sorting_option_changed', properties);
  },
  tagFilterChanged: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('tag_filter_changed', properties);
  },
  // Bottom Action Row
  selectQueryClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('select_query_clicked', properties);
  },
  deleteQueryClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('delete_query_clicked', properties);
  },
  duplicateQueryClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('duplicate_query_clicked', properties);
  },
  saveRecentQueryClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('save_recent_query_clicked', properties);
  },
  lockQueryClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('lock_query_clicked', properties);
  },
  // Editing
  editQueryClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('edit_query_clicked', properties);
  },
  cancelEditClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('cancel_edit_clicked', properties);
  },
  saveEditClicked: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('save_edit_clicked', properties);
  },
  queryLibraryClosedToEditQueryInExplore: (properties?: QueryLibraryEventsPropertyMap) => {
    queryLibraryInteraction('query_library_closed_to_edit_query_in_explore', properties);
  },
};

export const dirtyFieldsToAnalyticsObject = (
  dirtyFields: Partial<{
    title?: boolean;
    description?: boolean;
    isVisible?: boolean;
    tags?: boolean[];
  }>
) => {
  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(dirtyFields)) {
    if (typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
};
