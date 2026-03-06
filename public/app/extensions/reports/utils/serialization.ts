import { dateTimeForTimeZone } from '@grafana/data';
import {
  ReportDashboard,
  ReportDTOV2,
  ReportFormV2,
  ReportFormat,
  ReportState,
  ReportSchedulingFrequencyV2,
  LAST_DAY_OF_MONTH,
  ReportV2,
  SendTime,
  ReportSchedule,
  ReportSchedulingFrequency,
  Report,
} from 'app/extensions/types/reports';
import { parseReportTimeRange } from 'app/extensions/utils/time';
import { emailSeparator } from 'app/extensions/utils/validators';

import { SelectDashboardScene } from '../ReportFormV2/sections/SelectDashboards/SelectDashboardScene';
import { getTimezone } from '../state/reducers';

import { getDashboardsDTO } from './dashboards';
import { createDate, getDateV2 } from './dateTime';

export const transformReportV2ToDTO = (
  report: Partial<ReportFormV2> & { id?: number; state?: ReportState; dashboardsScene: SelectDashboardScene[] }
): ReportDTOV2 => {
  let dashboardsDTO: ReportDashboard[] = [];
  if (report.dashboardsScene) {
    dashboardsDTO = getDashboardsDTO(report.dashboardsScene);
  }

  const formats = [
    { condition: report.attachments?.pdf, format: ReportFormat.PDF },
    { condition: report.attachments?.csv, format: ReportFormat.CSV },
    { condition: report.attachments?.pdfTables, format: ReportFormat.PDFTables },
    { condition: report.pdfOptions?.dashboardPDF?.addPDFTablesAppendix, format: ReportFormat.PDFTablesAppendix },
    { condition: report.addDashboardImage, format: ReportFormat.Image },
  ].reduce<ReportFormat[]>((acc, { condition, format }) => {
    if (condition) {
      acc.push(format);
    }
    return acc;
  }, []);

  const { startDate, startTime, endDate, endTime, timeZone } = report.schedule || {};

  let combinedStartDate: string | undefined = undefined;
  if (startDate) {
    const parsedStartTime = { hour: startTime?.hour?.() ?? 0, minute: startTime?.minute?.() ?? 0 };
    combinedStartDate = createDate(startDate, parsedStartTime, timeZone);
  }

  let combinedEndDate: string | undefined = undefined;
  if (endDate) {
    const parsedEndTime = { hour: endTime?.hour?.() ?? 0, minute: endTime?.minute?.() ?? 0 };
    combinedEndDate = createDate(endDate, parsedEndTime, timeZone);
  }

  const reportDTO: ReportDTOV2 = {
    id: report.id ?? 0,
    subject: report.subject,
    state: report.state ?? ReportState.Draft,
    message: report.message || '',
    name: report.title || '',
    replyTo: report.replyTo || '',
    recipients: report.recipients?.join(',') || '',
    formats,
    options: {
      orientation: report.pdfOptions?.orientation || 'landscape',
      layout: report.pdfOptions?.layout || 'grid',
      pdfShowTemplateVariables: report.pdfOptions?.dashboardPDF?.showTemplateVariables || false,
      pdfCombineOneFile: report.pdfOptions?.dashboardPDF?.combineOneFile || false,
    },
    enableDashboardUrl: report.addDashboardUrl,
    dashboards: dashboardsDTO,
    scaleFactor: report.pdfOptions?.scaleFactor,
    schedule: {
      intervalFrequency: report.schedule?.intervalFrequency,
      intervalAmount: report.schedule?.intervalAmount,
      workdaysOnly: report.schedule?.workdaysOnly,
      timeZone: report.schedule?.timeZone || getTimezone(),
      frequency: report.schedule?.frequency || ReportSchedulingFrequencyV2.Daily,
      dayOfMonth: report.schedule?.lastDayOfMonthOnly ? LAST_DAY_OF_MONTH : undefined,
      startDate: combinedStartDate,
      endDate: combinedEndDate,
    },
  };

  return reportDTO;
};

export const transformDTOV2ToReportV2 = (reportDTO: ReportDTOV2): ReportV2 => {
  const attachments = {
    pdf: reportDTO.formats.includes(ReportFormat.PDF),
    csv: reportDTO.formats.includes(ReportFormat.CSV),
    pdfTables: reportDTO.formats.includes(ReportFormat.PDFTables),
  };

  const pdfOptions = {
    orientation: reportDTO.options.orientation,
    layout: reportDTO.options.layout,
    scaleFactor: reportDTO.scaleFactor ?? 1,
    dashboardPDF: {
      showTemplateVariables: reportDTO.options.pdfShowTemplateVariables ?? false,
      combineOneFile: reportDTO.options.pdfCombineOneFile ?? false,
      addPDFTablesAppendix: reportDTO.formats.includes(ReportFormat.PDFTablesAppendix),
    },
  };

  const schedule: ReportSchedule = {
    frequency: reportDTO.schedule.frequency,
    timeZone: reportDTO.schedule.timeZone,
    startDate: reportDTO.schedule.startDate ? getDateV2(reportDTO.schedule.startDate) : undefined,
    startTime: reportDTO.schedule.startDate
      ? dateTimeForTimeZone(reportDTO.schedule.timeZone, reportDTO.schedule.startDate)
      : undefined,
    endDate: reportDTO.schedule.endDate ? getDateV2(reportDTO.schedule.endDate) : undefined,
    endTime: reportDTO.schedule.endDate
      ? dateTimeForTimeZone(reportDTO.schedule.timeZone, reportDTO.schedule.endDate)
      : undefined,
    intervalFrequency: reportDTO.schedule.intervalFrequency,
    intervalAmount: reportDTO.schedule.intervalAmount,
    workdaysOnly: reportDTO.schedule.workdaysOnly,
    lastDayOfMonthOnly: reportDTO.schedule.dayOfMonth === LAST_DAY_OF_MONTH,
    sendTime: reportDTO.schedule.startDate ? SendTime.Later : SendTime.Now,
  };

  return {
    id: reportDTO.id,
    title: reportDTO.name,
    subject: reportDTO.subject,
    message: reportDTO.message,
    replyTo: reportDTO.replyTo,
    // this is needed because non recipients means empty string in the backend
    recipients: reportDTO.recipients ? reportDTO.recipients.split(emailSeparator) : [],
    attachments,
    pdfOptions,
    addDashboardUrl: reportDTO.enableDashboardUrl ?? false,
    addDashboardImage: reportDTO.formats.includes(ReportFormat.Image),
    dashboards: reportDTO.dashboards.map((dashboard) => ({
      uid: dashboard.dashboard?.uid,
      title: dashboard.dashboard?.name,
      variables: dashboard.reportVariables,
      timeRange: parseReportTimeRange(dashboard.timeRange),
    })),
    schedule,
    state: reportDTO.state ?? ReportState.Draft,
  };
};

export const transformReportDTOV2ToReport = (reportDTO: ReportDTOV2): Report => {
  return {
    ...reportDTO,
    schedule: {
      ...reportDTO.schedule,
      frequency: reportDTO.schedule.frequency as unknown as ReportSchedulingFrequency,
    },
  };
};

export const transformReportToReportDTOV2 = (report: Report): ReportDTOV2 => {
  return {
    ...report,
    schedule: {
      ...report.schedule,
      frequency: report.schedule.frequency as unknown as ReportSchedulingFrequencyV2,
    },
  };
};
