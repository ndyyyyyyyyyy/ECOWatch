import { t } from '@grafana/i18n';
import { handleError } from 'app/api/utils';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';

import { QUERY_LIBRARY_GET_LIMIT } from './baseAPI';
import { generatedAPI } from './endpoints.gen';

export const queriesAPIv1beta1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    // Need to mutate the generated query to force query limit
    listQuery: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) =>
          originalQuery({
            ...requestOptions,
            limit: QUERY_LIBRARY_GET_LIMIT,
          });
      }
    },
    // Need to mutate the generated query to set the Content-Type header correctly
    updateQuery: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) => ({
          ...originalQuery(requestOptions),
          headers: {
            'Content-Type': 'application/merge-patch+json',
          },
        });
      }
      endpointDefinition.onQueryStarted = async (_, { queryFulfilled, dispatch }) => {
        await queryFulfilled;
        try {
          dispatch(
            notifyApp(
              createSuccessNotification(
                t('explore.query-library.query-template-edited', 'Query template successfully edited')
              )
            )
          );
        } catch (e) {
          handleError(
            e,
            dispatch,
            t('explore.query-library.query-template-edit-error', 'Error attempting to edit this query')
          );
        }
      };
    },
    createQuery: (endpointDefinition) => {
      endpointDefinition.onQueryStarted = async (_, { queryFulfilled, dispatch }) => {
        // due to the fact that we're rendering the list after the query is created,
        // we need to update the cached list so we show the new query instantly,
        const { data } = await queryFulfilled;
        dispatch(
          generatedAPI.util.updateQueryData('listQuery', {}, (list) => {
            list.items = [...(list.items || []), data];
          })
        );
      };
    },
  },
});

export const { useCreateQueryMutation, useDeleteQueryMutation, useListQueryQuery, useUpdateQueryMutation } =
  queriesAPIv1beta1;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export type { QuerySpec, Query, ListQueryApiResponse } from './endpoints.gen';
