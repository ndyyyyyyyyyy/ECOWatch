import { css, cx } from '@emotion/css';
import { capitalize } from 'lodash';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';
import { useNavigate } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { FieldSet, Icon, LinkButton, useStyles2 } from '@grafana/ui';
import { formatUtcOffset } from '@grafana/ui/internal';
import config from 'app/core/config';

import {
  EnterpriseStoreState,
  ReportDataToRender,
  ReportFormat,
  ReportState,
  SchedulingData,
  ReportSchedulingFrequency,
  StepKey,
} from '../../types';
import { REPORT_BASE_URL, getZoomOptions } from '../constants';
import { createReport, updateReport } from '../state/actions';
import { clearReportState, initialState } from '../state/reducers';
import { getFormatted, getTimeRangeDisplay } from '../utils/dateTime';
import { getFormatsDisplay } from '../utils/formats';
import { schedulePreview, showWorkdaysOnly } from '../utils/scheduler';
import { getSectionUrl } from '../utils/url';
import { getMissingFields } from '../utils/validation';
import { getPreviewVariables } from '../utils/variables';

import { DashboardLink } from './DashboardLink';
import ReportForm from './ReportForm';

const mapStateToProps = (state: EnterpriseStoreState) => {
  const { report, isUpdated } = state.reports;
  return {
    report,
    isUpdated,
  };
};

const mapActionsToProps = {
  createReport,
  updateReport,
  clearReportState,
};

const connector = connect(mapStateToProps, mapActionsToProps);
export type Props = ConnectedProps<typeof connector> & { reportId?: string };

export const Confirm = ({ report, createReport, updateReport, clearReportState, isUpdated, reportId }: Props) => {
  const { formats, options, schedule, dashboards } = report;
  const {
    handleSubmit,
    formState: { isSubmitSuccessful },
  } = useForm();
  const navigate = useNavigate();

  const styles = useStyles2(getStyles);
  const editMode = !!reportId && !isUpdated;
  const disableSubmit = getMissingFields(report);

  const { time: startTime, date: startDate } = getFormatted(schedule.startDate, schedule.timeZone);
  const { time: endTime, date: endDate } = getFormatted(schedule.endDate, schedule.timeZone);

  useEffect(() => {
    if (isSubmitSuccessful) {
      navigate(REPORT_BASE_URL);
    }
  }, [isSubmitSuccessful, navigate]);

  const submitReport = async () => {
    const createOrUpdate = !!report.id ? updateReport : createReport;
    if (report.state === ReportState.Draft) {
      const newState =
        report.schedule.frequency === ReportSchedulingFrequency.Never ? ReportState.Never : ReportState.Scheduled;
      report = { ...report, state: newState };
    }
    await createOrUpdate(report);
    reportInteraction('reports_report_submitted', {
      replyToPopulated: !!report.replyTo,
      includesDashboardLink: report.enableDashboardUrl,
      numberOfDashboardsSelected: report.dashboards.length,
      templateVariablesSelected: report.dashboards.some((db) => !!db.reportVariables),
      orientation: report.options.orientation,
      layout: report.options.layout,
      frequency: report.schedule.frequency,
      sendTime: report.schedule.startDate ? 'later' : 'now',
      endDate: !!report.schedule.endDate,
    });
    clearReportState();
  };

  const { orientation: defaultOrientation, layout: defaultLayout } = initialState.report.options;
  const newPDFRenderingEnabled = config.featureToggles.newPDFRendering!;
  const reportData: ReportDataToRender = [
    {
      title: t('reports.confirm.report-data.title.select-dashboard', 'Select dashboard'),
      id: StepKey.SelectDashboard,
      items: (dashboards || []).flatMap((field, index, arr) => {
        const previewVariables = getPreviewVariables(field.reportVariables, field.dashboard?.uid);
        return [
          {
            title: `Source dashboard${index === 0 ? '*' : ''}`, // Only the first db is required
            value: field.dashboard?.uid ? (
              <DashboardLink name={field.dashboard.name} uid={field.dashboard?.uid} className={styles.dashboardLink} />
            ) : (
              ''
            ),
            id: 'name',
            required: true,
          },
          {
            title: t('reports.confirm.report-data.title.template-variables', 'Template variables'),
            value: <VariablesPreview previewVariables={previewVariables} className={styles.title} />,
          },
          {
            title: t('reports.confirm.report-data.title.time-range', 'Time range'),
            value: getTimeRangeDisplay(field.timeRange),
          },
          // Add empty row for spacing in case of multiple dashboards
          ...(arr.length > 1 && index !== arr.length - 1 ? [{ title: '', value: '' }] : []),
        ];
      }),
    },
    {
      title: t('reports.confirm.report-data.title.format-report', 'Format report'),
      id: StepKey.FormatReport,
      items: [
        {
          title: t('reports.confirm.report-data.title.preferred-format', 'Preferred format*'),
          value: getFormatsDisplay(formats),
          id: 'formats',
          required: true,
        },
        ...(formats.includes(ReportFormat.PDF)
          ? newPDFRenderingEnabled
            ? [
                {
                  title: t('reports.confirm.report-data.title.pdf-orientation', 'PDF orientation'),
                  value: capitalize(options.orientation || defaultOrientation),
                },
                {
                  title: t('reports.confirm.report-data.title.pdf-layout', 'PDF layout'),
                  value: capitalize(options.layout || defaultLayout),
                },
                {
                  title: t('reports.confirm.report-data.title.scale-factor', 'Scale factor'),
                  value:
                    getZoomOptions(newPDFRenderingEnabled).find(
                      (option) => option.value === report.scaleFactor && !option.isDisabled
                    )?.label || '100%',
                },
                {
                  title: t(
                    'reports.confirm.report-data.title.pdf-show-template-variables',
                    'PDF show template variables'
                  ),
                  value: options.pdfShowTemplateVariables ? 'Yes' : 'No',
                },
                {
                  title: t(
                    'reports.confirm.report-data.title.combine-all-pdfs-in-one-file',
                    'Combine all PDFs in one file'
                  ),
                  value: options.pdfCombineOneFile ? 'Yes' : 'No',
                },
              ]
            : [
                {
                  title: t('reports.confirm.report-data.title.pdf-orientation', 'PDF orientation'),
                  value: capitalize(options.orientation || defaultOrientation),
                },
                {
                  title: t('reports.confirm.report-data.title.pdf-layout', 'PDF layout'),
                  value: capitalize(options.layout || defaultLayout),
                },
                {
                  title: t('reports.confirm.report-data.title.scale-factor', 'Scale factor'),
                  value:
                    getZoomOptions(newPDFRenderingEnabled).find(
                      (option) => option.value === report.scaleFactor && !option.isDisabled
                    )?.label || '100%',
                },
              ]
          : []),
      ],
    },
    {
      title: t('reports.confirm.report-data.title.schedule', 'Schedule'),
      id: StepKey.Schedule,
      items: [
        {
          title: t('reports.confirm.report-data.title.recurrence', 'Recurrence'),
          value: capitalize(schedule.frequency),
        },
        ...(schedule.frequency === ReportSchedulingFrequency.Custom
          ? [
              {
                title: t('reports.confirm.report-data.title.repeat-every', 'Repeat every'),
                value: `${schedule.intervalAmount} ${schedule.intervalFrequency}`,
              },
            ]
          : []),
        ...(schedule.frequency !== ReportSchedulingFrequency.Never
          ? [
              { title: t('reports.confirm.report-data.title.start-date', 'Start date'), value: startDate || 'Now' },
              { title: t('reports.confirm.report-data.title.start-time', 'Start time'), value: startTime || 'Now' },
              { title: t('reports.confirm.report-data.title.end-date', 'End date'), value: endDate },
              { title: t('reports.confirm.report-data.title.end-time', 'End time'), value: endTime },
              {
                title: t('reports.confirm.report-data.title.time-zone', 'Time zone'),
                value: schedule.timeZone ? formatUtcOffset(Date.now(), schedule.timeZone) : '',
              },
            ]
          : []),
        ...(showWorkdaysOnly(schedule.frequency, schedule.intervalFrequency)
          ? [
              {
                title: t('reports.confirm.report-data.title.send-monday-to-friday-only', 'Send Monday to Friday only'),
                value: schedule.workdaysOnly ? (
                  <Icon name={'check'} size={'xl'} />
                ) : (
                  <Icon name={'minus'} size={'xl'} />
                ),
              },
            ]
          : []),
        { value: schedulePreview(report.schedule as SchedulingData), title: '' },
      ],
    },
    {
      title: t('reports.confirm.report-data.title.share', 'Share'),
      id: StepKey.Share,
      items: [
        // id key is required for fields that need validation
        {
          title: t('reports.confirm.report-data.title.report-name', 'Report name*'),
          value: report.name,
          id: 'name',
          required: true,
        },
        {
          title: t('reports.confirm.report-data.title.email-subject', 'Email subject'),
          value: report.subject,
          id: 'subject',
        },
        {
          title: t('reports.confirm.report-data.title.recipients', 'Recipients*'),
          value: report.recipients,
          id: 'recipients',
          required: true,
        },
        {
          title: t('reports.confirm.report-data.title.replytoemail', 'Reply-to-email'),
          value: report.replyTo || 'none',
        },
        { title: t('reports.confirm.report-data.title.message', 'Message'), value: report.message || 'none' },
        {
          title: t('reports.confirm.report-data.title.dashboard-link', 'Dashboard link'),
          value: report.enableDashboardUrl ? 'Yes' : 'No',
        },
      ],
    },
  ];

  return (
    <ReportForm
      activeStep={StepKey.Confirm}
      confirmRedirect={!isSubmitSuccessful && isUpdated}
      disabled={disableSubmit}
      editMode={editMode}
      onSubmit={handleSubmit(submitReport)}
      reportId={reportId}
    >
      <FieldSet label={editMode ? '' : t('reporting.report-form.edit-step', '5. Confirm')}>
        {reportData.map((section) => {
          const hasMissingFields = getMissingFields(report, section.id);
          return (
            <div className={styles.section} key={section.title}>
              <div className={styles.sectionHeader}>
                <h5 className={styles.sectionTitle}>{section.title}</h5>
                <LinkButton
                  variant={hasMissingFields ? 'primary' : 'secondary'}
                  fill={'text'}
                  href={getSectionUrl(section.id, reportId)}
                  size={'sm'}
                >
                  <Trans i18nKey="reports.confirm.edit">Edit</Trans>
                </LinkButton>
              </div>
              {section.items
                // Undefined value means the item shouldn't be rendered
                .filter((item) => item.value !== undefined)
                .map((row, index) => {
                  const missingValue =
                    !!row.required && (!row.value || (Array.isArray(row.value) && !row.value.length));
                  return !!row.title ? (
                    <div className={styles.row} key={index}>
                      <div className={cx(styles.title, missingValue && styles.warning)}>{row.title}:</div>
                      <div className={cx(styles.value, row.value === 'none' && !missingValue ? styles.textMuted : '')}>
                        {missingValue ? <Icon name={'exclamation-triangle'} className={styles.warning} /> : row.value}
                      </div>
                    </div>
                  ) : (
                    <div className={cx(styles.row, styles.textMuted)} key={index}>
                      {row.value}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </FieldSet>
    </ReportForm>
  );
};

export default connector(Confirm);

const getStyles = (theme: GrafanaTheme2) => {
  return {
    section: css({
      width: '100%',
      padding: theme.spacing(3, 0),
      marginBottom: theme.spacing(3),
    }),
    sectionHeader: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1),
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    sectionTitle: css({
      margin: 0,
    }),
    row: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderTop: 'none',
      display: 'flex',
      width: '100%',
      padding: theme.spacing(1),
    }),
    warning: css({
      color: theme.colors.warning.text,
    }),
    title: css({
      width: '30%',
      color: theme.colors.text.secondary,
    }),
    textMuted: css({
      color: theme.colors.text.secondary,
    }),
    value: css({
      width: '70%',
      wordBreak: 'break-word',
    }),
    dashboardLink: css({
      color: theme.colors.text.primary,
      fontSize: theme.typography.body.fontSize,
      marginTop: 0,
    }),
  };
};

interface VariablesPreviewProps {
  className?: string;
  previewVariables?: Array<[string, string[]]>;
}

const VariablesPreview = ({ className, previewVariables }: VariablesPreviewProps) => {
  const styles = useStyles2(getStyles);
  if (!previewVariables || !previewVariables.length) {
    return (
      <span className={styles.textMuted}>
        <Trans i18nKey="reports.variables-preview.none">none</Trans>
      </span>
    );
  }

  return (
    <>
      {previewVariables.map(([key, value]) => {
        return (
          <span key={key}>
            <span className={className}>{key}</span>: {value.join(', ')};{' '}
          </span>
        );
      })}
    </>
  );
};
