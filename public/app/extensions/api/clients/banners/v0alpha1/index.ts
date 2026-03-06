import { generatedAPI } from './endpoints.gen';

export const announcementBannerAPIv0alpha1 = generatedAPI.enhanceEndpoints({});

export const {
  useCreateAnnouncementBannerMutation,
  useReplaceAnnouncementBannerMutation,
  useListAnnouncementBannerQuery,
} = announcementBannerAPIv0alpha1;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export type { Spec, AnnouncementBanner } from './endpoints.gen';
