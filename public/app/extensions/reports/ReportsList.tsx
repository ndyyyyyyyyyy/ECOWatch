import { css, cx } from '@emotion/css';
import { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, CardContainer, ConfirmButton, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { selectors } from 'app/extensions/reports/e2e-selectors/selectors';

import { AccessControlAction, Report, ReportState } from '../types';
import { emailSeparator } from '../utils/validators';

import { ReportStateLegend } from './ReportStateLegend';
import { getButtonText } from './utils/pageActions';
import { getReportStateInfo, getToggledReportState } from './utils/reportState';
import { parseScheduleTime } from './utils/scheduler';
import { getMissingFields } from './utils/validation';

interface Props {
  reports: Report[];
  deleteReport: (report: Report) => void;
  updateReport: (report: Report, refetch?: boolean) => void;
  onClick?: (report: Report) => void;
  redirectTo?: (report: Report) => string;
  filter: string;
}

const filterReports = (reports: Report[], filter: string) => {
  const filterFields: Array<keyof Pick<Report, 'name' | 'dashboardName' | 'recipients'>> = ['name', 'recipients'];

  const dbFilter = (report: Report) =>
    report.dashboards.some(({ dashboard }) => dashboard?.name.toLowerCase().includes(filter.toLowerCase()));

  return reports.filter((report) => {
    return (
      filterFields.some((field) => report[field]?.toLowerCase().includes(filter.toLowerCase())) || dbFilter(report)
    );
  });
};

export const ReportList: FC<Props> = ({ deleteReport, updateReport, reports, filter, onClick, redirectTo }) => {
  const styles = useStyles2(getStyles);

  const toggleReportState = (report: Report) => {
    const newState = getToggledReportState(report.state);

    updateReport(
      {
        ...report,
        state: newState,
      },
      true
    );
  };

  const canEditReport = contextSrv.hasPermission(AccessControlAction.ReportingWrite);
  const canDeleteReport = contextSrv.hasPermission(AccessControlAction.ReportingDelete);

  const getButtonTooltipText = (
    report: Report<Record<string, string[]>>,
    showPlay: boolean,
    reportState: ReportState
  ) => {
    if (showPlay) {
      if (reportState === ReportState.Draft) {
        return getButtonText(report.schedule);
      } else {
        return t('reporting.report-list.content-resume-report', 'Resume report');
      }
    } else {
      return t('reporting.report-list.content-pause-report', 'Pause report');
    }
  };

  return (
    <div data-testid={selectors.components.ReportsList.container}>
      {filterReports(reports, filter).map((report) => {
        const splitRecipients = !!report.recipients ? report.recipients.split(emailSeparator).filter(Boolean) : [];
        const numRecipients = splitRecipients.length;
        const scheduleTime = parseScheduleTime(report.schedule);
        const { isNever, showPlay, disableEdit, reportState } = getReportStateInfo(report);

        const recipientsText = `${numRecipients} recipient${numRecipients !== 1 ? 's' : ''}`;
        return (
          <CardContainer key={report.id} href={redirectTo?.(report)} className={styles.container}>
            <div className={cx(styles.box, { [styles.boxPadding]: !redirectTo })}>
              <Stack flex={1} direction={{ xs: 'column', md: 'row' }} gap={4} justifyContent="space-between">
                <Stack
                  onClick={() => onClick?.(report)}
                  flex={1}
                  direction={{ xs: 'column', md: 'row' }}
                  gap={4}
                  justifyContent="space-between"
                >
                  <div className={styles.info}>
                    <span className={styles.title}>{report.name}</span>
                    <span className={styles.dashboards}>
                      {[...new Set(report.dashboards.map(({ dashboard }) => dashboard?.name))].join(', ')}
                    </span>
                  </div>
                  {numRecipients ? (
                    <div className={cx(styles.recipients, styles.recipientsBox)}>
                      <Tooltip content={splitRecipients.join(', ')} placement={'top'}>
                        <div>{recipientsText}</div>
                      </Tooltip>
                    </div>
                  ) : (
                    <div className={styles.recipientsBox}>{recipientsText}</div>
                  )}
                  <div className={styles.schedule}>
                    <ReportStateLegend reportState={reportState} />
                    {!isNever && <span className={styles.text}>{scheduleTime}</span>}
                  </div>
                </Stack>

                <div className={styles.buttonWrapper}>
                  <Button
                    tooltip={getButtonTooltipText(report, showPlay, reportState)}
                    tooltipPlacement="top"
                    type={'button'}
                    variant={'secondary'}
                    fill={'text'}
                    icon={showPlay ? 'play' : 'pause'}
                    size={'md'}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleReportState(report);
                    }}
                    disabled={disableEdit || !canEditReport || getMissingFields(report)}
                  />

                  <ConfirmButton
                    confirmText={t('reporting.report-list.confirmText-delete', 'Delete')}
                    confirmVariant="destructive"
                    size={'md'}
                    disabled={!canDeleteReport}
                    onConfirm={() => deleteReport(report)}
                  >
                    <Button
                      type="button"
                      className={styles.deleteButton}
                      aria-label={t('reporting.report-list.delete-report', 'Delete report {{name}}', {
                        name: report.name,
                      })}
                      variant="secondary"
                      icon="trash-alt"
                      size={'md'}
                      fill={'text'}
                    />
                  </ConfirmButton>
                </div>
              </Stack>
            </div>
          </CardContainer>
        );
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    box: css({
      display: 'flex',
      width: '100%',
    }),
    boxPadding: css({
      padding: theme.spacing(2),
    }),
    container: css({
      '& > a': {
        alignItems: 'center',
      },
    }),
    info: css({
      display: 'flex',
      flexDirection: 'column',
      [theme.breakpoints.up('md')]: {
        width: '30%',
      },
    }),
    title: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightBold,
    }),
    dashboards: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    recipients: css({
      cursor: 'pointer',

      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    recipientsBox: css({
      display: 'flex',
      width: '25%',
    }),
    schedule: css({
      display: 'flex',
      flexDirection: 'column',
      [theme.breakpoints.up('md')]: {
        width: '40%',
      },
    }),
    buttonWrapper: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      '& > button': {
        '&[disabled]': {
          pointerEvents: 'all',
        },
      },
    }),
    deleteButton: css({
      '&:hover': {
        color: theme.colors.error.text,
      },
    }),
    text: css({
      color: theme.colors.text.secondary,
    }),
  };
};
