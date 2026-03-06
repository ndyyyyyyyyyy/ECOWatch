import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from 'app/api/createBaseQuery';
import { getAPIBaseURL } from 'app/api/utils';

export const BASE_URL = getAPIBaseURL('banners.grafana.app', 'v0alpha1');

export const api = createApi({
  reducerPath: 'announcementBannerAPIv0alpha1',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  tagTypes: ['AnnouncementBannerList'],
  endpoints: () => ({}),
});
