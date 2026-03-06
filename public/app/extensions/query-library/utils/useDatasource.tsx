import { useAsync } from 'react-use';

import { getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';

export function useDatasource(dataSourceRef?: DataSourceRef | null) {
  const { value, loading } = useAsync(async () => {
    const templateSrv = getTemplateSrv();
    // we don't want to store datasource variables in the query library
    return getDataSourceSrv().get(
      dataSourceRef?.uid
        ? {
            ...dataSourceRef,
            uid: templateSrv.replace(dataSourceRef.uid),
          }
        : dataSourceRef
    );
  }, [dataSourceRef]);
  return { value, loading };
}
