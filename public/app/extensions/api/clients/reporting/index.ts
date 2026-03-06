import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { transformDTOV2ToReportV2 } from 'app/extensions/reports/utils/serialization';
import { CreateReportDTOV2, DraftReportDTOV2, ReportDTOV2, ReportV2, ReportsSettings } from 'app/extensions/types';

import { BASE_URL, reportingAPI as reportingAPIBase } from './baseAPI';

export const reportingAPI = reportingAPIBase.injectEndpoints({
  endpoints: (builder) => ({
    getReports: builder.query<ReportDTOV2[], void>({
      query: () => ({
        url: '/',
        method: 'GET',
        showErrorAlert: true,
      }),
      providesTags: ['Reports'],
    }),
    getReportsByDashboard: builder.query<ReportDTOV2[], string>({
      query: (dashboardUid) => ({
        url: `/dashboards/${dashboardUid}`,
        method: 'GET',
        showErrorAlert: true,
      }),
      providesTags: (result, error, dashboardUid) => [{ type: 'Reports', id: dashboardUid }],
    }),
    getReport: builder.query<ReportV2, number | undefined>({
      query: (reportId) => ({
        url: `/${reportId}`,
        method: 'GET',
        showErrorAlert: true,
      }),
      transformResponse: (response: ReportDTOV2) => {
        return transformDTOV2ToReportV2(response);
      },
      providesTags: (result, error, reportId) => [{ type: 'Report', id: reportId }],
    }),
    createReport: builder.mutation<void, CreateReportDTOV2>({
      query: (report) => ({
        url: '/',
        method: 'POST',
        body: report,
        showErrorAlert: true,
      }),
      invalidatesTags: (result, error, arg) => (error ? [] : ['Reports']),
    }),
    saveDraftReport: builder.mutation<void, DraftReportDTOV2>({
      query: (report) => ({
        url: '/',
        method: 'POST',
        body: report,
        showErrorAlert: true,
      }),
      invalidatesTags: (result, error, arg) => (error ? [] : ['Reports']),
    }),
    updateReport: builder.mutation<void, ReportDTOV2>({
      query: (report) => ({
        url: `/${report.id}`,
        method: 'PUT',
        body: report,
        showErrorAlert: true,
      }),
      invalidatesTags: (result, error, arg) => (error ? [] : ['Reports', { type: 'Report', id: arg.id }]),
    }),
    updateStateReport: builder.mutation<void, ReportDTOV2>({
      query: (report) => ({
        url: `/${report.id}`,
        method: 'PUT',
        body: report,
        showErrorAlert: true,
      }),
      invalidatesTags: (result, error, arg) => (error ? [] : ['Reports', { type: 'Report', id: arg.id }]),
    }),
    deleteReport: builder.mutation<void, number>({
      query: (reportId) => ({
        url: `/${reportId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, arg) => (error ? [] : ['Reports']),
    }),
    sendTestEmail: builder.mutation<void, DraftReportDTOV2>({
      query: (report) => ({
        url: '/test-email/',
        method: 'POST',
        body: report,
        showErrorAlert: true,
      }),
    }),
    getSettings: builder.query<ReportsSettings, void>({
      query: () => ({
        url: `/settings`,
        method: 'GET',
        showErrorAlert: true,
      }),
      providesTags: ['Settings'],
    }),
    saveSettings: builder.mutation<void, ReportsSettings>({
      queryFn: async (settings, { dispatch, getState }) => {
        const formData = new FormData();

        // Handle file uploads in branding
        for (const [field, value] of Object.entries(settings.branding)) {
          if (value instanceof File) {
            // Update the copy to use the filename instead of the File object
            settings.branding = { ...settings.branding, [field]: value.name };
            formData.append('files', value);
          }
        }

        formData.append('config', JSON.stringify(settings));

        try {
          // Use fetch directly to avoid header parsing issues
          const response = await fetch(`${BASE_URL}/settings`, {
            method: 'POST',
            body: formData, // Don't set Content-Type - let browser handle it
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          dispatch(notifyApp(createSuccessNotification('Successfully saved configuration')));
          return { data: result };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          dispatch(notifyApp(createErrorNotification('Error saving configuration', errorMessage)));
          return { error: errorMessage };
        }
      },
      invalidatesTags: (result, error, arg) => (error ? [] : ['Settings']),
    }),
  }),
});

export const {
  useCreateReportMutation,
  useSaveDraftReportMutation,
  useSendTestEmailMutation,
  useGetReportsByDashboardQuery,
  useGetReportQuery,
  useUpdateReportMutation,
  useUpdateStateReportMutation,
  useDeleteReportMutation,
  useGetReportsQuery,
  useGetSettingsQuery,
  useSaveSettingsMutation,
} = reportingAPI;
