import { QueryTemplate } from '../../features/explore/QueryLibrary/types';

export type QueryTemplateRow = QueryTemplate & {
  index: string;
};

export type QueryLibraryEventsPropertyMap = Record<string, string | boolean | undefined>;
