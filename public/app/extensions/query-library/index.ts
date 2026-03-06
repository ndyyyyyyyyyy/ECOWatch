import { CoreApp } from '@grafana/data';
import { t } from '@grafana/i18n';
import { addEnterpriseProviders } from 'app/AppWrapper';
import { appEvents } from 'app/core/core';
import { QueryLibraryDrawerOptions } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import { ShowConfirmModalEvent } from 'app/types/events';

import { QueryLibraryContextProvider } from './QueryLibraryContextProvider';

export function initQueryLibrary() {
  addEnterpriseProviders(QueryLibraryContextProvider);
}

export function getQueryLibraryRenderContext(app?: string): string {
  switch (app) {
    case CoreApp.Explore:
      return CoreApp.Explore;
    case CoreApp.PanelEditor:
      return CoreApp.PanelEditor;
    default:
      return 'unknown';
  }
}

/**
 * This is used to determine the app that the query library is rendered in.
 * It's needed to render the QueryEditor component.
 * Otherwise, it could break due to unsupported query options
 * Defaults to Explore if no context is provided.
 */
export function parseQueryLibraryRenderContext(context?: string): CoreApp {
  switch (context) {
    case CoreApp.PanelEditor:
      return CoreApp.PanelEditor;
    case CoreApp.Explore:
    case 'rich-history':
    default:
      return CoreApp.Explore;
  }
}

export const showDiscardAddQueryModal = (onConfirm: () => void) => {
  appEvents.publish(
    new ShowConfirmModalEvent({
      title: t('query-library.discard-changes.title', 'Discard changes to query?'),
      text: t(
        'query-library.discard-changes.text',
        'You have unsaved changes to this query. Are you sure you want to discard them?'
      ),
      icon: 'trash-alt',
      yesText: t('query-library.discard-changes.discard-button', 'Discard'),
      onConfirm,
    })
  );
};

export const getQueryLibraryDrawerAction = ({
  query,
  options,
}: Pick<QueryLibraryDrawerOptions, 'query' | 'options'>) => {
  if (query) {
    return 'save';
  }
  if (options?.isReplacingQuery) {
    return 'replace';
  }
  if (options?.highlightQuery) {
    return 'edit';
  }
  return 'add';
};
