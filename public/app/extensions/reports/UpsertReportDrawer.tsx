import { lazy, Suspense, useState } from 'react';

import { t } from '@grafana/i18n';
import { Alert, Drawer, LoadingPlaceholder, Spinner, Stack } from '@grafana/ui';
import { useUrlParams } from 'app/core/navigation/hooks';
import { useGetReportQuery } from 'app/extensions/api/clients/reporting';

import { SectionId } from './ReportFormV2/sections/types';
import { ReportRenderingProvider, RenderingContextEnum } from './dashboard-scene/ReportRenderingProvider';
import { showDiscardReportModal } from './utils/drawer';

const ReportForm = lazy(() => import('./ReportFormV2/ReportForm'));

export function UpsertReportDrawer() {
  const [isDirty, setIsDirty] = useState(false);

  const [params, updateUrlParams] = useUrlParams();
  const reportId = Number(params.get('reportId'));

  const {
    data: report,
    isLoading,
    isFetching,
    isError,
  } = useGetReportQuery(reportId, {
    skip: !reportId,
  });

  const isEditMode = !!reportId;

  const clearParams = () => {
    updateUrlParams({ reportView: null, reportId: null });
  };

  const onClose = () => {
    if (isDirty) {
      showDiscardReportModal(clearParams, RenderingContextEnum.ReportPage);
    } else {
      clearParams();
    }
  };

  return (
    <Drawer
      title={
        isEditMode
          ? t('reporting.update-report.title', 'Update report')
          : t('reporting.create-report.title', 'Create new report')
      }
      size="md"
      onClose={onClose}
    >
      <Stack direction="column" flex={1} height="100%">
        {isLoading ? (
          <LoadingPlaceholder text={t('reporting.create-report.loading-report', 'Loading report...')} />
        ) : (
          <>
            {isError ? (
              <Alert title={t('reporting.create-report.alert-title', 'Error loading report')} severity="error" />
            ) : (
              <Suspense
                fallback={<LoadingPlaceholder text={t('share-report.loading-report-form', 'Loading report form...')} />}
              >
                <ReportRenderingProvider
                  renderingFormContext={{
                    renderingContext: RenderingContextEnum.ReportPage,
                  }}
                >
                  <ReportForm
                    report={reportId ? report : undefined}
                    setIsDirty={setIsDirty}
                    onSuccess={clearParams}
                    defaultOpenSections={{
                      [SectionId.SelectDashboards]: true,
                      [SectionId.Schedule]: true,
                      [SectionId.EmailConfiguration]: isEditMode,
                      [SectionId.Recipients]: true,
                      [SectionId.Attachments]: isEditMode,
                    }}
                    headerActions={isFetching && <Spinner />}
                  />
                </ReportRenderingProvider>
              </Suspense>
            )}
          </>
        )}
      </Stack>
    </Drawer>
  );
}
