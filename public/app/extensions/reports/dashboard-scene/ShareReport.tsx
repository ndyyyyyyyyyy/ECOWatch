import { css } from '@emotion/css';
import { lazy, Suspense, useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { featureEnabled, locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import {
  Button,
  Stack,
  LoadingPlaceholder,
  Spinner,
  TextLink,
  EmptyState,
  Box,
  useStyles2,
  LinkButton,
  Alert,
} from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification } from 'app/core/copy/appNotification';
import { useUrlParams } from 'app/core/navigation/hooks';
import {
  useDeleteReportMutation,
  useGetReportQuery,
  useGetReportsByDashboardQuery,
  useUpdateReportMutation,
} from 'app/extensions/api/clients/reporting';
import { highlightTrial } from 'app/features/admin/utils';
import { SceneShareTabState, ShareView } from 'app/features/dashboard-scene/sharing/types';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/utils';
import { useDispatch } from 'app/types/store';

import { Report, ReportV2 } from '../../types';
import { SectionId } from '../ReportFormV2/sections/types';
import { ReportList } from '../ReportsList';
import { UnavailableFeatureInfoBox } from '../UnavailableFeatureInfoBox';
import { REPORT_BASE_URL } from '../constants';
import { getTemplateVariables } from '../utils/dashboards';
import { showDiscardReportModal } from '../utils/drawer';
import { transformReportDTOV2ToReport, transformReportToReportDTOV2 } from '../utils/serialization';

import { HighlightTrialReport } from './HighlightTrialReport';
import { ReportRenderingProvider, RenderingContextEnum } from './ReportRenderingProvider';

const ReportForm = lazy(() => import('../ReportFormV2/ReportForm'));

const ReportListView = ({
  showLoadingSpinner,
  onCreateReportClick,
  onDeleteReportClick,
  onUpdateReportClick,
  reports,
  isError,
}: {
  showLoadingSpinner: boolean;
  onCreateReportClick: () => void;
  onDeleteReportClick: (report: Report) => void;
  onUpdateReportClick: (report: Report) => void;
  reports: Report[];
  isError: boolean;
}) => {
  const isReportsCreationEnabled = featureEnabled('reports.creation');
  const location = useLocation();

  const styles = useStyles2(getStyles);

  return (
    <Box height="100%" display="flex" direction="column">
      <Stack flex={1} direction="column" gap={2}>
        <div className={styles.listHeader}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between">
            {showLoadingSpinner && <Spinner />}
            <Stack gap={1} direction={{ xs: 'column', md: 'row' }} flex={1} justifyContent="flex-end">
              {isReportsCreationEnabled && (
                <Button variant="primary" onClick={onCreateReportClick} icon="plus">
                  {t('share-report.create-report', 'Create a new report')}
                </Button>
              )}
              <LinkButton variant="secondary" href={REPORT_BASE_URL}>
                {t('share-report.see-all-reports', 'See all reports')}
              </LinkButton>
            </Stack>
          </Stack>
        </div>
        {isError ? (
          <Alert title={t('share-report.error-list.title', 'Error loading reports')} severity="error" />
        ) : reports?.length ? (
          <ReportList
            reports={reports}
            deleteReport={onDeleteReportClick}
            updateReport={onUpdateReportClick}
            redirectTo={(report) => `${location.pathname}?${location.search}&reportId=${report.id}`}
            filter=""
          />
        ) : (
          <Stack flex={1} direction="column" justifyContent="center">
            <EmptyState
              variant="call-to-action"
              message={t('share-report.empty-list.title', 'There are no reports for this dashboard')}
            >
              <Trans i18nKey="share-report.empty-list.description">
                Create a report from this dashboard.{' '}
                <TextLink external href="https://grafana.com/docs/grafana/latest/dashboards/create-reports/">
                  Learn more
                </TextLink>
              </Trans>
            </EmptyState>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

export interface ShareReportState extends SceneShareTabState {
  onClose: () => void;
  isDirty: boolean;
}

export class ShareReport extends SceneObjectBase<ShareReportState> implements ShareView {
  static Component = ShareReportRenderer;

  constructor(state: Partial<ShareReportState>) {
    super({ isDirty: false, onClose: () => {}, ...state });
  }

  public getTabLabel() {
    return 'Schedule report';
  }

  onClose = () => {
    locationService.partial({ shareView: null, reportId: null, reportView: null });
  };

  onDismiss = () => {
    if (this.state.isDirty) {
      showDiscardReportModal(this.onClose, RenderingContextEnum.DashboardPage);
    } else {
      this.onClose();
    }
  };
}

function ShareReportRenderer({ model }: SceneComponentProps<ShareReport>) {
  const isReportsCreationDisabled = !featureEnabled('reports.creation');
  const dashboard = getDashboardSceneFor(model);

  const dispatch = useDispatch();

  const [params, updateUrlParams] = useUrlParams();

  const reportId = Number(params.get('reportId'));
  const isReportCreationView = params.get('reportView') === 'new';
  const isReportView = params.get('shareView') === 'report';

  const {
    data: reportsList,
    isLoading: isReportsListLoading,
    isFetching: isReportsListFetching,
    isError: isReportsListError,
  } = useGetReportsByDashboardQuery(dashboard.state.uid!, {
    skip: !!reportId || isReportCreationView || !isReportView,
  });
  const [deleteReport, { isLoading: isDeleteReportLoading }] = useDeleteReportMutation();
  const [updateReport, { isLoading: isUpdateReportLoading }] = useUpdateReportMutation();

  const {
    data: report,
    isLoading: isReportLoading,
    isFetching: isReportFetching,
    isError: isReportError,
  } = useGetReportQuery(reportId, {
    skip: !reportId,
  });

  const reports: Report[] = reportsList?.map((report) => transformReportDTOV2ToReport(report)) || [];
  const showLoadingSpinner = isReportsListFetching || isDeleteReportLoading || isUpdateReportLoading;
  const isEditMode = !!reportId;

  const formReport: Partial<ReportV2> = useMemo(() => {
    if (reportId && report) {
      return report;
    }

    const { from, to, raw } = dashboard.state.$timeRange?.state.value || {};
    const timeRange = {
      from: raw?.from.toString() ?? from?.toISOString() ?? '',
      to: raw?.to.toString() ?? to?.toISOString() ?? '',
    };

    let templateVariables: Record<string, string[]> = {};
    try {
      templateVariables = getTemplateVariables(dashboard.state.$variables);
    } catch (e) {
      dispatch(
        notifyApp(
          createErrorNotification(
            e instanceof Error ? e.message : 'Reporting: Error when trying to get template variables from dashboard'
          )
        )
      );
    }

    return {
      title: dashboard.state.title,
      dashboards: [
        {
          uid: dashboard.state.uid,
          title: dashboard.state.title,
          timeRange: timeRange,
          variables: templateVariables,
        },
      ],
    };
  }, [dashboard, reportId, report, dispatch]);

  const setIsDirty = (isDirty: boolean) => {
    model.setState({ isDirty });
  };

  const onCreateReportClick = () => {
    updateUrlParams({ reportView: 'new', reportId: null });
  };

  const onDeleteReportClick = async (report: Report) => {
    await deleteReport(report.id).unwrap();
    reset();
  };

  const onUpdateReportClick = async (report: Report) => {
    const reportDTO = transformReportToReportDTOV2(report);
    await updateReport(reportDTO).unwrap();
    reset();
  };

  const reset = () => {
    model.setState({ isDirty: false });
    updateUrlParams({ reportView: null, reportId: null });
  };

  const onBackToListClick = () => {
    if (model.state.isDirty) {
      showDiscardReportModal(reset, RenderingContextEnum.DashboardPage);
    } else {
      reset();
    }
  };

  if (isReportsListLoading) {
    return <LoadingPlaceholder text={t('share-report.loading-reports', 'Loading reports...')} />;
  }

  if (isReportLoading) {
    return <LoadingPlaceholder text={t('share-report.loading-report', 'Loading report...')} />;
  }

  if (!isReportView) {
    return null;
  }

  if (isReportView && !reportId && !isReportCreationView) {
    return (
      <>
        {isReportsCreationDisabled && (
          <UnavailableFeatureInfoBox
            message={t(
              'share-report.unavailable-feature-info-box.message',
              'Creating new reports is not available with an expired license. Existing reports continue to be processed but you need to update your license to create a new one.'
            )}
          />
        )}
        <ReportListView
          showLoadingSpinner={showLoadingSpinner}
          onCreateReportClick={onCreateReportClick}
          onDeleteReportClick={onDeleteReportClick}
          onUpdateReportClick={onUpdateReportClick}
          reports={reports}
          isError={isReportsListError}
        />
      </>
    );
  }

  return (
    <Box height="100%" display="flex" direction="column">
      {highlightTrial() && <HighlightTrialReport />}
      <Suspense
        fallback={<LoadingPlaceholder text={t('share-report.loading-report-form', 'Loading report form...')} />}
      >
        <Stack flex={1} direction="column">
          {isReportError ? (
            <Alert title={t('share-report.error-form.title', 'Error loading report')} severity="error" />
          ) : (
            <ReportRenderingProvider
              renderingFormContext={{
                renderingContext: RenderingContextEnum.DashboardPage,
              }}
            >
              <ReportForm
                report={formReport}
                setIsDirty={setIsDirty}
                onSuccess={reset}
                headerActions={
                  <Stack>
                    <Button variant="secondary" icon="angle-left" onClick={onBackToListClick}>
                      {t('share-report.back-button-text', 'Back to reports list')}
                    </Button>
                    {isReportFetching && <Spinner />}
                  </Stack>
                }
                defaultOpenSections={{
                  [SectionId.SelectDashboards]: isEditMode,
                  [SectionId.Schedule]: true,
                  [SectionId.EmailConfiguration]: isEditMode,
                  [SectionId.Recipients]: true,
                  [SectionId.Attachments]: isEditMode,
                }}
              />
            </ReportRenderingProvider>
          )}
        </Stack>
      </Suspense>
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  listHeader: css({
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    background: theme.colors.background.primary,
    zIndex: theme.zIndex.modal,
    marginTop: theme.spacing(-2),
    paddingTop: theme.spacing(2),
    marginBottom: theme.spacing(-2),
    paddingBottom: theme.spacing(2),
  }),
});
