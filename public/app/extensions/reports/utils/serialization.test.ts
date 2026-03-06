import {
  ReportDTOV2,
  ReportFormat,
  ReportIntervalFrequency,
  ReportSchedulingFrequencyV2,
  ReportState,
  ReportV2,
  SendTime,
} from 'app/extensions/types';

import { transformDTOV2ToReportV2 } from './serialization';

describe('serialization utils', () => {
  describe('transformDTOV2ToReportV2', () => {
    const report: ReportDTOV2 = {
      id: 235,
      name: 'Report name',
      subject: 'Report subject',
      recipients: 'recipient1@test.com;recipient2@test.com;recipient3@test.com;recipient4@test.com',
      replyTo: 'reply-to@test.com',
      message:
        'Hi, \nPlease find attached a PDF status report. If you have any questions, feel free to contact me!\nBest,',
      schedule: {
        startDate: '2025-07-17T15:44:57-03:00',
        frequency: ReportSchedulingFrequencyV2.Weekly,
        intervalFrequency: ReportIntervalFrequency.Days,
        intervalAmount: 0,
        workdaysOnly: false,
        dayOfMonth: '',
        timeZone: 'America/Buenos_Aires',
      },
      options: {
        orientation: 'landscape',
        layout: 'grid',
        timeRange: {
          from: '',
          to: '',
        },
        pdfShowTemplateVariables: false,
        pdfCombineOneFile: false,
      },
      enableDashboardUrl: true,
      state: ReportState.Scheduled,
      dashboards: [
        {
          dashboard: {
            uid: 'test-influx-pubdash',
            name: 'Test influx pubdash',
          },
          timeRange: {
            from: 'now-1h',
            to: 'now',
          },
          reportVariables: {
            datacenter: [''],
            host: ['All'],
            summarize: ['1m'],
            adhoc: [],
          },
        },
      ],
      formats: [ReportFormat.PDF],
      scaleFactor: 100,
    };

    it('should transform dto to report', () => {
      const result = transformDTOV2ToReportV2(report);
      expect(result).toEqual<ReportV2>({
        id: 235,
        title: 'Report name',
        subject: 'Report subject',
        message:
          'Hi, \nPlease find attached a PDF status report. If you have any questions, feel free to contact me!\nBest,',
        replyTo: 'reply-to@test.com',
        recipients: ['recipient1@test.com', 'recipient2@test.com', 'recipient3@test.com', 'recipient4@test.com'],
        attachments: {
          pdf: true,
          csv: false,
          pdfTables: false,
        },
        pdfOptions: {
          orientation: 'landscape',
          layout: 'grid',
          scaleFactor: 100,
          dashboardPDF: {
            showTemplateVariables: false,
            combineOneFile: false,
            addPDFTablesAppendix: false,
          },
        },
        addDashboardUrl: true,
        addDashboardImage: false,
        schedule: {
          sendTime: SendTime.Later,
          frequency: ReportSchedulingFrequencyV2.Weekly,
          intervalFrequency: ReportIntervalFrequency.Days,
          lastDayOfMonthOnly: false,
          intervalAmount: 0,
          workdaysOnly: false,
          timeZone: 'America/Buenos_Aires',
          startDate: expect.any(Date),
          endDate: undefined,
          startTime: expect.any(Object),
          endTime: undefined,
        },

        state: ReportState.Scheduled,
        dashboards: [
          {
            uid: 'test-influx-pubdash',
            title: 'Test influx pubdash',
            timeRange: {
              from: 'now-1h',
              to: 'now',
              raw: {
                from: 'now-1h',
                to: 'now',
              },
            },
            variables: {
              datacenter: [''],
              host: ['All'],
              summarize: ['1m'],
              adhoc: [],
            },
          },
        ],
      });
    });

    it('should transform recipients correctly', () => {
      const recipientsWithCommaSeparator =
        'recipient1@test.com,recipient2@test.com,recipient3@test.com,recipient4@test.com';
      const recipientsWithSemicolonSeparator =
        'recipient1@test.com;recipient2@test.com;recipient3@test.com;recipient4@test.com';

      const reportWithCommaSeparator: ReportDTOV2 = {
        ...report,
        recipients: recipientsWithCommaSeparator,
      };

      const result: ReportV2 = transformDTOV2ToReportV2(reportWithCommaSeparator);
      expect(result.recipients).toEqual([
        'recipient1@test.com',
        'recipient2@test.com',
        'recipient3@test.com',
        'recipient4@test.com',
      ]);

      const reportWithSemicolonSeparator: ReportDTOV2 = {
        ...report,
        recipients: recipientsWithSemicolonSeparator,
      };

      const resultWithSemicolonSeparator: ReportV2 = transformDTOV2ToReportV2(reportWithSemicolonSeparator);
      expect(resultWithSemicolonSeparator.recipients).toEqual([
        'recipient1@test.com',
        'recipient2@test.com',
        'recipient3@test.com',
        'recipient4@test.com',
      ]);
    });
  });
});
