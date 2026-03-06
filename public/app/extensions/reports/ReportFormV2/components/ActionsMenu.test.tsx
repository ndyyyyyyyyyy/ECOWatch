import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { getDefaultTimeRange } from '@grafana/data';
import {
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  VariableValueSelectors,
  SceneDataLayerControls,
} from '@grafana/scenes';
import { ReportBaseV2, ReportSchedulingFrequencyV2, SendTime } from 'app/extensions/types';

import { getRange } from '../../../utils/time';
import { API_RENDER_PDFS } from '../../constants';
import { selectors } from '../../e2e-selectors/selectors';
import { defaultTimeRange } from '../../state/reducers';
import { getTemplateVariables } from '../../utils/dashboards';
import { SelectDashboardScene } from '../sections/SelectDashboards/SelectDashboardScene';

import ActionsMenu from './ActionsMenu';

const actionsMenuSelectors = selectors.components.ReportFormDrawer.ActionsMenu;

// Create test variable
const varA = new TestVariable({
  name: 'A',
  query: 'A.*',
  value: 'A.AA',
  text: '',
  options: [],
  delayMs: 0,
});

// Create mock dashboard
const createMockDashboard = () => {
  const timeRange = getDefaultTimeRange();
  return new SelectDashboardScene({
    uid: 'test-dashboard',
    title: 'Test Dashboard',
    $timeRange: new SceneTimeRange({
      from: timeRange.from.valueOf().toString(),
      to: timeRange.to.valueOf().toString(),
      timeZone: 'browser',
    }),
    $variables: new SceneVariableSet({ variables: [varA] }),
    variableControls: [new VariableValueSelectors({ layout: 'vertical' }), new SceneDataLayerControls()],
    onRemoveClick: () => {},
  });
};

const mockDashboards = [createMockDashboard()];

const defaultValues: ReportBaseV2 = {
  title: 'Test Report',
  schedule: {
    frequency: ReportSchedulingFrequencyV2.Daily,
    timeZone: 'UTC',
    sendTime: SendTime.Now,
  },
  recipients: ['test@example.com'],
  message: 'Test message',
  attachments: {
    pdf: true,
    csv: true,
    pdfTables: false,
  },
  pdfOptions: {
    scaleFactor: 150,
    orientation: 'portrait',
    layout: 'simple',
    dashboardPDF: {
      showTemplateVariables: true,
      combineOneFile: true,
      addPDFTablesAppendix: false,
    },
  },
  addDashboardUrl: true,
  addDashboardImage: true,
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<ReportBaseV2>({
    defaultValues,
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

function setup() {
  return {
    ...render(
      <TestWrapper>
        <ActionsMenu sceneDashboards={mockDashboards} />
      </TestWrapper>
    ),
    user: userEvent.setup({ delay: null }),
  };
}

describe('ActionsMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    window.open = jest.fn();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('it should render all menu items when actions menu button is clicked', async () => {
    const { user } = setup();
    const menuButton = screen.getByTestId(selectors.components.ReportFormDrawer.actionsMenuButton);
    await user.click(menuButton);

    expect(screen.getByTestId(actionsMenuSelectors.downloadCsv)).toBeInTheDocument();
    expect(screen.getByTestId(actionsMenuSelectors.previewPdf)).toBeInTheDocument();
    expect(screen.getByTestId(actionsMenuSelectors.reportSettings)).toBeInTheDocument();
  });

  it('should handle CSV download', async () => {
    const { user } = setup();
    const menuButton = screen.getByTestId(selectors.components.ReportFormDrawer.actionsMenuButton);
    await user.click(menuButton);

    const downloadCSVButton = screen.getByTestId(actionsMenuSelectors.downloadCsv);
    await user.click(downloadCSVButton);

    jest.advanceTimersByTime(100);

    // First state: Download starting
    await waitFor(() => {
      expect(screen.getByTestId(actionsMenuSelectors.downloadCsv)).toHaveTextContent(/downloading/i);
      expect(downloadCSVButton).toBeDisabled();
    });

    // Second state: Download completed
    await waitFor(() => {
      expect(downloadCSVButton).not.toBeDisabled();
    });
  });

  it('should generate correct preview PDF URL', async () => {
    const { user } = setup();
    const menuButton = screen.getByTestId(selectors.components.ReportFormDrawer.actionsMenuButton);
    await user.click(menuButton);

    const previewPdfButton = screen.getByTestId(actionsMenuSelectors.previewPdf);
    await user.click(previewPdfButton);

    expect(window.open).toHaveBeenCalledWith(expect.stringContaining(API_RENDER_PDFS), '_blank');

    // Get the URL that was passed to window.open
    const url = new URL((window.open as jest.Mock).mock.calls[0][0], window.location.origin);
    const params = new URLSearchParams(url.search);

    expect(params.get('title')).toBe(defaultValues.title);
    expect(params.get('scaleFactor')).toBe(defaultValues.pdfOptions?.scaleFactor.toString());
    expect(params.get('orientation')).toBe(defaultValues.pdfOptions?.orientation);
    expect(params.get('layout')).toBe(defaultValues.pdfOptions?.layout);
    expect(params.get('pdfShowTemplateVariables')).toBe(
      defaultValues.pdfOptions?.dashboardPDF?.showTemplateVariables.toString()
    );
    expect(params.get('pdfCombineOneFile')).toBe(defaultValues.pdfOptions?.dashboardPDF?.combineOneFile.toString());
    expect(params.get('includeTables')).toBe(defaultValues.pdfOptions?.dashboardPDF?.addPDFTablesAppendix.toString());

    // Parse the dashboards parameter which is a JSON string
    const dashboardsParam = JSON.parse(params.get('dashboards') || '[]');
    expect(dashboardsParam[0].dashboard.uid).toBe(mockDashboards[0].state.uid);
    const { from, to } = getRange(mockDashboards[0].state.$timeRange?.state.value).raw || defaultTimeRange.raw;
    expect(dashboardsParam[0].timeRange.from).toBe(from.valueOf().toString());
    expect(dashboardsParam[0].timeRange.to).toBe(to.valueOf().toString());
    const vars = getTemplateVariables(mockDashboards[0].state.$variables);
    expect(dashboardsParam[0].reportVariables).toEqual(vars);
  });

  it('should have correct href for report settings', async () => {
    const { user } = setup();
    const menuButton = screen.getByTestId(selectors.components.ReportFormDrawer.actionsMenuButton);
    await user.click(menuButton);

    const reportSettingsButton = screen.getByTestId(actionsMenuSelectors.reportSettings);
    expect(reportSettingsButton).toHaveAttribute('href', '/reports?reportView=settings');
  });
});
