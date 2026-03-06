import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from 'app/api/createBaseQuery';
import { getAPIBaseURL } from 'app/api/utils';

export const BASE_URL = getAPIBaseURL('alertenrichment.grafana.app', 'v1beta1');

export const api = createApi({
  reducerPath: 'alertEnrichmentAPIv1beta1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  tagTypes: ['AlertEnrichmentList'],
  endpoints: () => ({}),
});
