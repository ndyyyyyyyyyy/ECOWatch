import { E2ESelectors } from '@grafana/e2e-selectors';

export const QueryLibraryComponents = {
  saveQueryButton: {
    button: 'data-testid save to query library button',
  },
  saveQueryModal: {
    modal: 'data-testid save to query library modal',
    cancel: 'data-testid save to query library modal cancel',
    confirm: 'data-testid save to query library modal confirm',
    title: 'data-testid save to query library modal title',
    description: 'data-testid save to query library modal description',
    tagsInput: 'data-testid save to query library modal tags input',
  },
  queryLibraryDrawer: {
    content: 'data-testid query library content',
    delete: 'data-testid query library delete',
    lock: 'data-testid query library lock',
    duplicate: 'data-testid query library duplicate',
    confirm: 'data-testid query library confirm',
    item: (title: string) => `data-testid query library item ${title}`,
    newBadge: 'data-testid query library new query badge',
    titleInput: 'data-testid query library title input',
    saveQueryButton: 'data-testid query library save query button',
  },
};

export const QueryLibraryPages = {};

export const selectors: {
  pages: E2ESelectors<typeof QueryLibraryPages>;
  components: E2ESelectors<typeof QueryLibraryComponents>;
} = {
  pages: QueryLibraryPages,
  components: QueryLibraryComponents,
};
