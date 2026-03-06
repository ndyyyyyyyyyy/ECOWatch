import { DataSourceApi } from '@grafana/data';
import { EditorMode } from '@grafana/plugin-ui';
import { DataQuery } from '@grafana/schema';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { parseQueryLibraryRenderContext } from '..';

interface Props {
  datasource: DataSourceApi<DataQuery>;
  query: DataQuery;
}

export function QueryLibraryEditor({ datasource, query }: Props) {
  const { context } = useQueryLibraryContext();

  const QueryEditor = datasource?.components?.QueryEditor;

  if (!QueryEditor) {
    return null;
  }

  return (
    <fieldset disabled>
      <QueryEditor
        datasource={datasource}
        // @ts-expect-error - editorMode is not a valid property of some datasources
        query={{ ...query, editorMode: EditorMode.Code }}
        queries={[query]}
        onChange={() => {}}
        onRunQuery={() => {}}
        // some datasources use app to get the query type options. Otherwise, it breaks
        app={parseQueryLibraryRenderContext(context)}
      />
    </fieldset>
  );
}
