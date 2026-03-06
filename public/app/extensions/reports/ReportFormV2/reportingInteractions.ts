import { rangeUtil } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { ReportDTOV2, ReportFormat } from '../../types';

export const ReportingInteractions = {
  saveClicked(context: string, reportDTO: ReportDTOV2) {
    reportingInteractions('save_clicked', context, transformReportDTOToProperties(reportDTO));
  },
  saveDraftClicked(context: string, reportDTO: ReportDTOV2) {
    reportingInteractions('save_draft_clicked', context, transformReportDTOToProperties(reportDTO));
  },
  sendPreviewClicked(context: string, properties?: Record<string, unknown>) {
    reportingInteractions('send_preview_clicked', context, properties);
  },
  downloadCSVClicked(context: string, properties?: Record<string, unknown>) {
    reportingInteractions('download_csv_clicked', context, properties);
  },
  previewPDFClicked(context: string, properties?: Record<string, unknown>) {
    reportingInteractions('preview_pdf_clicked', context, properties);
  },
  settingsClicked(context: string, properties?: Record<string, unknown>) {
    reportingInteractions('settings_clicked', context, properties);
  },
  sendClicked(context: string, properties?: Record<string, unknown>) {
    reportingInteractions('send_clicked', context, properties);
  },
  deleteClicked(context: string, properties?: Record<string, unknown>) {
    reportingInteractions('delete_clicked', context, properties);
  },
  pauseClicked(context: string, properties?: Record<string, unknown>) {
    reportingInteractions('pause_clicked', context, properties);
  },
  resumeClicked(context: string, properties?: Record<string, unknown>) {
    reportingInteractions('resume_clicked', context, properties);
  },
  discardClicked(context: string) {
    reportingInteractions('discard_clicked', context);
  },
};

const reportingInteractions = (name: string, context: string, properties?: Record<string, unknown>) => {
  reportInteraction(`report_${name}`, { context, ...properties });
};

const transformReportDTOToProperties = (reportDTO: ReportDTOV2) => {
  return {
    replyToPopulated: !!reportDTO.replyTo,
    includesDashboardLink: reportDTO.enableDashboardUrl,
    numberOfDashboardsSelected: reportDTO.dashboards.length,
    numberOfDashboardsWithAbsoluteTimeRange: reportDTO.dashboards.filter(
      (db) => !rangeUtil.isRelativeTimeRange(db.timeRange)
    ).length,
    templateVariablesSelected: reportDTO.dashboards.some((db) => !!db.reportVariables),
    orientation: reportDTO.options.orientation,
    layout: reportDTO.options.layout,
    frequency: reportDTO.schedule.frequency,
    sendTime: reportDTO.schedule.startDate ? 'later' : 'now',
    startDate: !!reportDTO.schedule.startDate,
    endDate: !!reportDTO.schedule.endDate,
    attachPDF: reportDTO.formats.includes(ReportFormat.PDF),
    attachPDFTables: reportDTO.formats.includes(ReportFormat.PDFTables),
    attachCSV: reportDTO.formats.includes(ReportFormat.CSV),
    attachImage: reportDTO.formats.includes(ReportFormat.Image),
    action: reportDTO.id === 0 ? 'create' : 'update',
  };
};
