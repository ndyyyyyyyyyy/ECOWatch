import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';
import { FormProvider, useFieldArray, useForm } from 'react-hook-form';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import { Divider, Field, Input, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';
import { FormPrompt } from 'app/core/components/FormPrompt/FormPrompt';
import {
  useCreateReportMutation,
  useDeleteReportMutation,
  useSaveDraftReportMutation,
  useUpdateReportMutation,
  useUpdateStateReportMutation,
} from 'app/extensions/api/clients/reporting';
import {
  ReportFormV2,
  ReportIntervalFrequency,
  ReportSchedulingFrequencyV2,
  ReportState,
  ReportV2,
  SendTime,
} from 'app/extensions/types/reports';

import { ShareDrawerConfirmAction } from '../../../features/dashboard-scene/sharing/ShareDrawer/ShareDrawerConfirmAction';
import { ReportStateLegend } from '../ReportStateLegend';
import { DEFAULT_EMAIL_MESSAGE, defaultZoom } from '../constants';
import { useReportFormContext } from '../dashboard-scene/ReportRenderingProvider';
import { selectors } from '../e2e-selectors/selectors';
import { getTimezone } from '../state/reducers';
import { canEditReport } from '../utils/permissions';
import { getToggledReportState } from '../utils/reportState';
import { transformReportV2ToDTO } from '../utils/serialization';
import { formSchemaValidationRules } from '../utils/validation';

import { ReportActions } from './ReportActions';
import { ReportingInteractions } from './reportingInteractions';
import { intervalOptions } from './sections/Schedule/SendLaterSchedule';
import { useSelectDashboards } from './sections/SelectDashboards/useSelectDashboards';
import { SectionId } from './sections/types';
import { REPORT_FORM_SECTIONS, useReportSections } from './sections/useReportSections';

const defaultReport: Partial<ReportFormV2> = {
  message: DEFAULT_EMAIL_MESSAGE,
  addDashboardUrl: true,
  addDashboardImage: false,
  schedule: {
    sendTime: SendTime.Later,
    frequency: ReportSchedulingFrequencyV2.Daily,
    startDate: new Date(),
    endTime: dateTime().add(2, 'hour').startOf('hour'),
    startTime: dateTime().add(1, 'hour').startOf('hour'),
    timeZone: getTimezone(),
  },
  attachments: {
    pdf: true,
    csv: false,
    pdfTables: false,
  },
  pdfOptions: {
    orientation: 'landscape',
    layout: 'grid',
    scaleFactor: defaultZoom,
  },
};

export default function ReportForm({
  report,
  setIsDirty,
  onSuccess,
  defaultOpenSections,
  headerActions,
}: {
  report?: Partial<ReportV2>;
  setIsDirty: (isDirty: boolean) => void;
  onSuccess: () => void;
  defaultOpenSections?: Partial<Record<SectionId, boolean>>;
  headerActions?: React.ReactNode;
}) {
  const styles = useStyles2(getStyles);
  const reportFormContext = useReportFormContext();

  const { openSections, setOpenSections, updateOpenSectionsByErrors } = useReportSections(defaultOpenSections);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const [createReport, { isLoading: isCreateReportLoading }] = useCreateReportMutation();
  const [updateReport, { isLoading: isUpdateReportLoading }] = useUpdateReportMutation();
  const [updateStateReport, { isLoading: isUpdateStateReportLoading }] = useUpdateStateReportMutation();
  const [saveDraftReport, { isLoading: isSaveDraftLoading }] = useSaveDraftReportMutation();
  const [deleteReport, { isLoading: isDeleteReportLoading }] = useDeleteReportMutation();

  const isUpsertLoading = isCreateReportLoading || isUpdateReportLoading || isUpdateStateReportLoading;

  const form = useForm<ReportFormV2>({
    mode: 'onSubmit',
    defaultValues: {
      ...defaultReport,
      ...report,
      schedule: {
        ...defaultReport.schedule,
        ...report?.schedule,
        intervalFrequency:
          intervalOptions.find((opt) => opt.value === report?.schedule?.intervalFrequency)?.value ||
          ReportIntervalFrequency.Hours,
      },
    },
    shouldUnregister: true,
    shouldFocusError: true,
  });

  const { remove: removeDashboard, append: appendDashboard } = useFieldArray({
    control: form.control,
    name: 'dashboards',
  });

  const { sceneDashboards, onAddDashboardClick, isLoadingDashboards } = useSelectDashboards({
    report,
    setValue: form.setValue,
    appendDashboard,
    removeDashboard,
  });

  useEffect(() => {
    if (!isLoadingDashboards) {
      form.setFocus('title');
    }
  }, [form, form.setFocus, isLoadingDashboards]);

  useEffect(() => {
    setIsDirty(form.formState.isDirty);
  }, [form.formState.isDirty, setIsDirty]);

  const onSubmit = async (data: ReportFormV2) => {
    const reportDTO = transformReportV2ToDTO({
      ...data,
      state: ReportState.Scheduled,
      dashboardsScene: sceneDashboards,
      id: report?.id,
    });

    ReportingInteractions.saveClicked(reportFormContext.renderingContext, reportDTO);

    const upsert = report?.id ? updateReport : createReport;
    await upsert(reportDTO).unwrap();
    onSuccess();
  };

  const onSaveDraftClick = async () => {
    const data = form.getValues();
    const reportDTO = transformReportV2ToDTO({
      ...data,
      state: ReportState.Draft,
      dashboardsScene: sceneDashboards,
      id: report?.id,
    });

    ReportingInteractions.saveDraftClicked(reportFormContext.renderingContext, reportDTO);

    const upsert = report?.id ? updateReport : saveDraftReport;
    await upsert(reportDTO).unwrap();
    onSuccess();
  };

  const onToggleStateClick = async () => {
    const data = form.getValues();
    const newState = report?.state && getToggledReportState(report.state);
    report?.state === ReportState.Scheduled
      ? ReportingInteractions.pauseClicked(reportFormContext.renderingContext)
      : ReportingInteractions.resumeClicked(reportFormContext.renderingContext);

    const reportDTO = transformReportV2ToDTO({
      ...data,
      state: newState,
      dashboardsScene: sceneDashboards,
      id: report?.id,
    });

    await updateStateReport(reportDTO).unwrap();
  };

  const onDeleteClick = () => {
    ReportingInteractions.deleteClicked(reportFormContext.renderingContext);
    setShowDeleteConfirmation(true);
  };

  const onDeleteConfirm = async () => {
    if (!report?.id) {
      return;
    }

    await deleteReport(report?.id).unwrap();
    setShowDeleteConfirmation(false);
    onSuccess();
  };

  return (
    <>
      <FormPrompt
        confirmRedirect={form.formState.isDirty}
        onDiscard={() => {
          ReportingInteractions.discardClicked(reportFormContext.renderingContext);
        }}
      />
      <div className={cx({ [styles.hidden]: !showDeleteConfirmation })}>
        <ShareDrawerConfirmAction
          title={t('share-report.confirm-delete.title', 'Delete report')}
          confirmButtonLabel={t('share-report.confirm-delete.button', 'Delete report')}
          onConfirm={onDeleteConfirm}
          onDismiss={() => setShowDeleteConfirmation(false)}
          description={t('share-report.confirm-delete.description', 'Are you sure you want to delete this report?')}
          isActionLoading={isDeleteReportLoading}
        />
      </div>
      <div className={cx(styles.formContainer, { [styles.hidden]: showDeleteConfirmation })}>
        <Stack justifyContent="space-between">
          {headerActions}
          <Stack justifyContent="space-between" flex={1}>
            {isLoadingDashboards && (
              <LoadingPlaceholder
                data-testid="form-loading-placeholder"
                text={t('share-report.loading-form', 'Loading form...')}
              />
            )}
            <div className={styles.stateContainer}>
              <Text>{t('share-report.state', 'State:')}</Text>
              <ReportStateLegend reportState={report?.state} />
            </div>
          </Stack>
        </Stack>
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, updateOpenSectionsByErrors)}
            className={styles.form}
            data-testid={selectors.components.ReportFormDrawer.container}
          >
            <fieldset
              disabled={
                !canEditReport ||
                isUpsertLoading ||
                isSaveDraftLoading ||
                isLoadingDashboards ||
                !featureEnabled('reports.creation')
              }
              className={styles.container}
            >
              <Field
                label={t('share-report.report-name.label', 'Report name')}
                required
                error={form.formState.errors.title?.message}
                invalid={!!form.formState.errors.title}
              >
                <Input
                  id="title"
                  {...form.register('title', formSchemaValidationRules().title)}
                  placeholder={report?.title}
                  type="text"
                  autoComplete="off"
                />
              </Field>
              <Divider spacing={0} />
              <div className={styles.reportSectionContainer}>
                <Stack direction="column" flex={1}>
                  {REPORT_FORM_SECTIONS.map((section, index) => (
                    <div key={section.id}>
                      <section.component
                        dashboards={sceneDashboards}
                        onAddDashboard={onAddDashboardClick}
                        open={openSections[section.id]}
                        onToggle={() =>
                          setOpenSections((prevState) => ({ ...prevState, [section.id]: !prevState[section.id] }))
                        }
                      />
                      {index < REPORT_FORM_SECTIONS.length - 1 && <Divider />}
                    </div>
                  ))}
                </Stack>
              </div>
              <div className={styles.actionsContainer}>
                <Divider />
                <ReportActions
                  isEditMode={!!report?.id}
                  isUpsertLoading={isUpsertLoading}
                  isUpdateStateReportLoading={isUpdateStateReportLoading}
                  isSaveDraftLoading={isSaveDraftLoading}
                  onSaveDraftClick={onSaveDraftClick}
                  onDeleteClick={onDeleteClick}
                  onToggleStateClick={onToggleStateClick}
                  sceneDashboards={sceneDashboards}
                  reportState={report?.state}
                />
              </div>
            </fieldset>
          </form>
        </FormProvider>
      </div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    form: css({
      height: '100%',
    }),
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }),
    reportSectionContainer: css({
      height: '100%',
      marginTop: theme.spacing(2),
    }),
    actionsContainer: css({
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%',
      background: theme.colors.background.primary,
      zIndex: theme.zIndex.tooltip,
      marginBottom: theme.spacing(-2),
      paddingBottom: theme.spacing(2),
    }),
    hidden: css({
      display: 'none',
    }),
    formContainer: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      flex: 1,
    }),
    stateContainer: css({
      display: 'flex',
      gap: theme.spacing(1),
      marginLeft: 'auto',
    }),
  };
};
