import { getDefaultTimeRange, dateTime, getTimeZoneGroups, VariableType } from '@grafana/data';
import {
  SceneDataLayerControls,
  VariableValueSelectors,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  AdHocFiltersVariable,
} from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import {
  ReportFormat,
  ReportFormV2,
  ReportIntervalFrequency,
  ReportSchedulingFrequencyV2,
  ReportState,
  SendTime,
} from '../../types';
import { SelectDashboardScene } from '../ReportFormV2/sections/SelectDashboards/SelectDashboardScene';

import { getTemplateVariables } from './dashboards';
import { transformReportV2ToDTO } from './serialization';

describe('transformReportToDTO', () => {
  const varA = new TestVariable({ name: 'A', query: 'A.*', value: 'A.AA', text: '', options: [], delayMs: 0 });

  const mockDashboardScene = new SelectDashboardScene({
    key: 'test-key',
    uid: 'test-uid',
    title: 'Test Dashboard',
    $timeRange: new SceneTimeRange({ value: getDefaultTimeRange() }),
    $variables: new SceneVariableSet({ variables: [varA] }),
    variableControls: [new VariableValueSelectors({ layout: 'vertical' }), new SceneDataLayerControls()],
  });

  it('should transform a basic report with minimal fields', () => {
    const report = {
      id: 1,
      title: 'Test Report',
      subject: 'Test Subject',
      recipients: ['test@test.com'],
      dashboardsScene: [mockDashboardScene],
      state: ReportState.Scheduled,
    };

    const result = transformReportV2ToDTO(report);

    expect(result).toEqual({
      id: 1,
      name: 'Test Report',
      subject: 'Test Subject',
      message: '',
      replyTo: '',
      recipients: 'test@test.com',
      formats: [],
      options: {
        orientation: 'landscape',
        layout: 'grid',
        pdfShowTemplateVariables: false,
        pdfCombineOneFile: false,
      },
      enableDashboardUrl: undefined,
      dashboards: [
        {
          dashboard: {
            uid: 'test-uid',
            name: 'Test Dashboard',
          },
          reportVariables: {
            A: ['A.AA'],
          },
          timeRange: {
            from: 'now-6h',
            to: 'now',
          },
        },
      ],
      scaleFactor: undefined,
      schedule: {
        frequency: ReportSchedulingFrequencyV2.Daily,
        timeZone: expect.any(String),
        dayOfMonth: undefined,
        startDate: undefined,
        endDate: undefined,
        intervalFrequency: undefined,
        intervalAmount: undefined,
        workdaysOnly: undefined,
      },
      state: ReportState.Scheduled,
    });
  });

  it('should handle all report formats correctly', () => {
    const report: Partial<ReportFormV2> & { dashboardsScene: SelectDashboardScene[] } = {
      title: 'Test Report',
      dashboardsScene: [mockDashboardScene],
      attachments: {
        pdf: true,
        csv: true,
        pdfTables: false,
      },
      pdfOptions: {
        dashboardPDF: {
          addPDFTablesAppendix: true,
          showTemplateVariables: true,
          combineOneFile: true,
        },
        orientation: 'landscape',
        layout: 'grid',
        scaleFactor: 100,
      },
      addDashboardImage: true,
    };

    const result = transformReportV2ToDTO(report);

    expect(result.formats).toEqual([
      ReportFormat.PDF,
      ReportFormat.CSV,
      ReportFormat.PDFTablesAppendix,
      ReportFormat.Image,
    ]);
    expect(result.options).toEqual({
      orientation: 'landscape',
      layout: 'grid',
      pdfShowTemplateVariables: true,
      pdfCombineOneFile: true,
    });
  });

  it('should handle schedule configuration correctly', () => {
    const mockDate = new Date('2024-01-01T12:00:00Z');
    const startTime = dateTime();
    startTime.set('hour', 8);
    startTime.set('minute', 0);
    const endTime = dateTime();
    endTime.set('hour', 17);
    endTime.set('minute', 30);
    const timeZone = getTimeZoneGroups()[0].zones[0];

    const report = {
      title: 'Test Report',
      dashboardsScene: [mockDashboardScene],
      schedule: {
        frequency: ReportSchedulingFrequencyV2.Weekly,
        intervalFrequency: ReportIntervalFrequency.Weeks,
        intervalAmount: 2,
        workdaysOnly: true,
        timeZone: timeZone,
        startDate: mockDate,
        startTime: startTime,
        endDate: mockDate,
        endTime: endTime,
        lastDayOfMonthOnly: true,
        sendTime: SendTime.Later,
      },
    };

    const result = transformReportV2ToDTO(report);

    expect(result.schedule).toEqual({
      frequency: ReportSchedulingFrequencyV2.Weekly,
      intervalFrequency: ReportIntervalFrequency.Weeks,
      intervalAmount: 2,
      workdaysOnly: true,
      timeZone: timeZone,
      dayOfMonth: 'last',
      startDate: '2024-01-01T08:00:00+00:00',
      endDate: '2024-01-01T17:30:00+00:00',
    });
  });

  it('should handle schedule configuration correctly without endTime', () => {
    const mockDate = new Date('2024-01-01T12:00:00Z');
    const startTime = dateTime();
    startTime.set('hour', 8);
    startTime.set('minute', 0);
    const timeZone = getTimeZoneGroups()[0].zones[0];

    const report = {
      title: 'Test Report',
      dashboardsScene: [mockDashboardScene],
      schedule: {
        frequency: ReportSchedulingFrequencyV2.Weekly,
        intervalFrequency: ReportIntervalFrequency.Weeks,
        intervalAmount: 2,
        workdaysOnly: true,
        timeZone: timeZone,
        startDate: mockDate,
        startTime: startTime,
        endDate: mockDate,
        lastDayOfMonthOnly: true,
        sendTime: SendTime.Later,
      },
    };

    const result = transformReportV2ToDTO(report);

    expect(result.schedule).toEqual({
      frequency: ReportSchedulingFrequencyV2.Weekly,
      intervalFrequency: ReportIntervalFrequency.Weeks,
      intervalAmount: 2,
      workdaysOnly: true,
      timeZone: timeZone,
      dayOfMonth: 'last',
      startDate: '2024-01-01T08:00:00+00:00',
      endDate: '2024-01-01T00:00:00+00:00',
    });
  });

  it('should handle dashboard correctly', () => {
    const varA = new TestVariable({ name: 'A', query: 'A.*', value: 'A.AA', text: '', options: [], delayMs: 0 });

    const dashboardWithVariables = new SelectDashboardScene({
      key: 'test-key',
      uid: 'test-uid',
      title: 'Test Dashboard',
      $timeRange: new SceneTimeRange({ value: getDefaultTimeRange() }),
      $variables: new SceneVariableSet({ variables: [varA] }),
      variableControls: [new VariableValueSelectors({ layout: 'vertical' }), new SceneDataLayerControls()],
    });

    const report = {
      title: 'Test Report',
      dashboardsScene: [dashboardWithVariables],
    };

    const result = transformReportV2ToDTO(report);

    expect(result.dashboards).toEqual([
      {
        dashboard: {
          uid: 'test-uid',
          name: 'Test Dashboard',
        },
        reportVariables: {
          A: ['A.AA'],
        },
        timeRange: {
          from: 'now-6h',
          to: 'now',
        },
      },
    ]);
  });
});

describe('getTemplateVariables', () => {
  it('should get template variables map for temp vars with value property', () => {
    const customVar = new TestVariable({ name: 'A', value: 'A.AA', text: 'A text', options: [], type: 'custom' });
    const queryVar = new TestVariable({
      name: 'B',
      query: 'B.*',
      value: 'B.BB',
      text: 'B text',
      options: [],
      type: 'query',
    });
    const dataSourceVar = new TestVariable({
      name: 'C',
      value: 'C.CC',
      text: 'C text',
      options: [],
      type: 'datasource',
    });
    const intervalVar = new TestVariable({ name: 'D', value: 'D.DD', text: 'D text', options: [], type: 'interval' });
    const constantVar = new TestVariable({ name: 'E', value: 'E.EE', text: 'E text', options: [], type: 'constant' });
    const textBoxVar = new TestVariable({ name: 'F', value: 'F.FF', text: 'F text', options: [], type: 'textbox' });
    const groupByVar = new TestVariable({ name: 'G', value: 'G.GG', text: 'G text', options: [], type: 'groupby' });

    const variables = new SceneVariableSet({
      variables: [customVar, queryVar, dataSourceVar, intervalVar, constantVar, textBoxVar, groupByVar],
    });
    const result = getTemplateVariables(variables);
    expect(result).toEqual({
      A: ['A.AA'],
      B: ['B.BB'],
      C: ['C.CC'],
      D: ['D.DD'],
      E: ['E.EE'],
      F: ['F.FF'],
      G: ['G.GG'],
    });
  });

  it('should get template variables map for adhoc variables', () => {
    const adhocVar = new AdHocFiltersVariable({
      name: 'A',
      filters: [{ key: 'A', operator: '=', value: 'A.AA' }],
    });
    const variables = new SceneVariableSet({ variables: [adhocVar] });
    const result = getTemplateVariables(variables);
    expect(result).toEqual({
      A: ['A|=|A.AA'],
    });
  });

  it('should correctly manage ALL case', () => {
    const queryVar = new TestVariable({
      name: 'B',
      query: 'B.*',
      value: [ALL_VARIABLE_VALUE],
      text: [ALL_VARIABLE_TEXT],
      options: [],
      type: 'query',
    });

    const variables = new SceneVariableSet({ variables: [queryVar] });
    const result = getTemplateVariables(variables);
    expect(result).toEqual({
      B: [ALL_VARIABLE_TEXT],
    });
  });

  it.each<[VariableType]>([['system'], ['snapshot']])(
    'should throw an error if the variable type is not supported (%s)',
    (type) => {
      const variables = new SceneVariableSet({ variables: [new TestVariable({ name: 'A', type })] });
      expect(() => getTemplateVariables(variables)).toThrow(`Reporting: Unsupported variable type ${type}`);
    }
  );
});
