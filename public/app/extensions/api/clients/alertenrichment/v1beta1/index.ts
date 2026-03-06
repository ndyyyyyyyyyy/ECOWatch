import { generatedAPI } from './endpoints.gen';

export const alertEnrichmentAPIv1beta1 = generatedAPI.enhanceEndpoints({});

export const {
  useListAlertEnrichmentQuery,
  useLazyListAlertEnrichmentQuery,
  useCreateAlertEnrichmentMutation,
  useDeleteAlertEnrichmentMutation,
} = alertEnrichmentAPIv1beta1;
