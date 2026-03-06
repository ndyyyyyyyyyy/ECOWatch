import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import { QueryTemplateRow } from './types';

export const newestSortingOption = () => ({
  value: 'newest',
  label: t('query-library.filters.sort.newest', 'Newest first'),
  sort: (a: QueryTemplateRow, b: QueryTemplateRow) => {
    const aCreatedAt = a.createdAtTimestamp ?? 0;
    const bCreatedAt = b.createdAtTimestamp ?? 0;
    return bCreatedAt - aCreatedAt;
  },
});

export const getQueryLibrarySortingOptions = (): Promise<SelectableValue[]> => {
  return Promise.resolve([
    {
      value: 'asc',
      label: t('query-library.filters.sort.asc', 'Alphabetically (A–Z)'),
      sort: (a: QueryTemplateRow, b: QueryTemplateRow) => {
        const aTitle = a.title ?? '';
        const bTitle = b.title ?? '';
        return aTitle.localeCompare(bTitle);
      },
    },
    {
      value: 'desc',
      label: t('query-library.filters.sort.desc', 'Alphabetically (Z–A)'),
      sort: (a: QueryTemplateRow, b: QueryTemplateRow) => {
        const aTitle = a.title ?? '';
        const bTitle = b.title ?? '';
        return bTitle.localeCompare(aTitle);
      },
    },
    newestSortingOption(),
    {
      value: 'oldest',
      label: t('query-library.filters.sort.oldest', 'Oldest first'),
      sort: (a: QueryTemplateRow, b: QueryTemplateRow) => {
        const aCreatedAt = a.createdAtTimestamp ?? 0;
        const bCreatedAt = b.createdAtTimestamp ?? 0;
        return aCreatedAt - bCreatedAt;
      },
    },
  ]);
};
