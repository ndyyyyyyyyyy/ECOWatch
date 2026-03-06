import { skipToken } from '@reduxjs/toolkit/query';
import { compact, uniq } from 'lodash';
import { useAsync } from 'react-use';
import { AsyncState } from 'react-use/lib/useAsync';

import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { QueryTemplate as QueryTemplateType } from '../../../features/explore/QueryLibrary/types';
import { QueryTemplateRow } from '../types';

import { QueryTemplate } from './types';

export function useLoadUsers(userUIDs: string[] | undefined) {
  const userQtList = uniq(compact(userUIDs));
  return useGetDisplayMappingQuery(
    userUIDs
      ? {
          key: userQtList,
        }
      : skipToken
  );
}

// Explicitly type the result so TS knows to discriminate between the error result and good result by the error prop
// value.
type MetadataValue =
  | {
      index: string;
      uid: string;
      datasourceName: string;
      datasourceRef: DataSourceRef | undefined | null;
      datasourceType: string;
      createdAtTimestamp: number;
      query: DataQuery;
      queryText?: string;
      title: string;
      description: string;
      tags: string[];
      isLocked: boolean;
      isVisible: boolean;
      user: {
        uid: string;
        displayName: string;
        avatarUrl: string;
      };
      error: undefined;
    }
  | {
      index: string;
      error: Error;
    };

/**
 * Map metadata to query templates we get from the DB.
 * @param queryTemplates
 * @param userDataList
 */
export function useLoadQueryMetadata(
  queryTemplates: QueryTemplate[] | undefined,
  userDataList: ReturnType<typeof useLoadUsers>['data']
): AsyncState<MetadataValue[] | undefined> {
  return useAsync(async () => {
    if (!(queryTemplates && userDataList)) {
      return;
    }

    const rowsPromises = queryTemplates.map(
      async (queryTemplate: QueryTemplate, index: number): Promise<MetadataValue> => {
        try {
          const datasourceRef = queryTemplate.targets[0]?.datasource;
          const datasourceApi = await getDataSourceSrv().get(datasourceRef);
          const datasourceType = getDatasourceSrv().getInstanceSettings(datasourceRef)?.meta.name || '';
          const query = queryTemplate.targets[0];
          const queryText = datasourceApi?.getQueryDisplayText?.(query);
          const datasourceName = datasourceApi?.name || '';
          const extendedUserData = userDataList.display.find(
            (user) => `${user?.identity.type}:${user?.identity.name}` === queryTemplate.user?.uid
          );

          return {
            index: index.toString(),
            uid: queryTemplate.uid,
            datasourceName,
            datasourceRef,
            datasourceType,
            createdAtTimestamp: queryTemplate?.createdAtTimestamp || 0,
            query,
            queryText,
            title: queryTemplate.title,
            description: queryTemplate.description || '',
            tags: queryTemplate.tags ?? [],
            isLocked: queryTemplate.isLocked ?? false,
            isVisible: queryTemplate.isVisible ?? false,
            user: {
              uid: queryTemplate.user?.uid || '',
              displayName: extendedUserData?.displayName || '',
              avatarUrl: extendedUserData?.avatarURL || '',
            },
            error: undefined,
          };
        } catch (error) {
          // Instead of throwing we collect the errors in the result so upstream code can decide what to do.
          return {
            index: index.toString(),
            error: error instanceof Error ? error : new Error('unknown error ' + JSON.stringify(error)),
          };
        }
      }
    );

    return Promise.all(rowsPromises);
  }, [queryTemplates, userDataList]);
}

export const useGetNewQuery = (query?: QueryTemplateType) => {
  const {
    data: userData,
    isLoading: isUserDataLoading,
    isError: isUserDataError,
  } = useLoadUsers(query ? [contextSrv.user.uid] : undefined);

  const {
    value: queryToAdd,
    loading: isQueryToAddLoading,
    error: queryToAddError,
  } = useAsync<() => Promise<QueryTemplateRow | undefined>>(async () => {
    if (!query || isUserDataLoading) {
      return undefined;
    }
    const datasource = await getDataSourceSrv().get(query.query.datasource);
    const datasourceType = getDatasourceSrv().getInstanceSettings(query.query.datasource)?.meta.name || '';

    return {
      ...query,
      uid: undefined,
      query: query.query,
      queryText: datasource?.getQueryDisplayText?.(query.query),
      datasourceName: datasource.name,
      datasourceType,
      title: query.title ?? 'New query',
      description: '',
      index: 'new',
      tags: [],
      isVisible: true,
      isLocked: false,
      datasourceRef: query.query.datasource,

      user: {
        uid: contextSrv.user?.uid || '',
        displayName: userData?.display[0]?.displayName || '',
        avatarUrl: userData?.display[0]?.avatarURL || '',
      },
    };
  }, [query, isUserDataLoading]);

  if (!query) {
    return {
      data: undefined,
      isLoading: false,
      isError: false,
    };
  }

  return {
    data: queryToAdd,
    isLoading: isQueryToAddLoading || isUserDataLoading,
    isError: Boolean(queryToAddError) || isUserDataError,
  };
};
