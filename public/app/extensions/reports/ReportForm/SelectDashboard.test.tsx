import { screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { getRouteComponentProps } from 'app/core/navigation/mocks/routeProps';
import { addRootReducer } from 'app/store/configureStore';

import { mockToolkitActionCreator } from '../../../../test/core/redux/mocks';
import { selectOptionInTest } from '../../../../test/helpers/selectOptionInTest';
import reportsReducers, { initialState, updateReportProp } from '../state/reducers';

import { SelectDashboards, Props } from './SelectDashboard';

let windowSpy: jest.SpyInstance;

// Create a flexible dashboard mock that can return different dashboards based on UID
type DashItem = { uid: string; value: number; title: string };
const mockDashboardData: Record<string, DashItem> = {
  test: { uid: 'test', value: 1, title: 'Test dashboard' },
  'test-1': { uid: 'test-1', value: 3, title: 'Dashboard 1' },
  'test-2': { uid: 'test-2', value: 2, title: 'Dashboard 2' },
};

const mockGetDashboardDTO = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  windowSpy = jest.spyOn(window, 'location', 'get');
  mockGetDashboardDTO.mockImplementation((uid: string) => {
    const dashboardData = mockDashboardData[uid] || mockDashboardData['test'];
    return Promise.resolve({
      dashboard: dashboardData,
      meta: {},
    });
  });
});

afterEach(() => {
  windowSpy.mockRestore();
});

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () => ({
    getDashboardDTO: mockGetDashboardDTO,
  }),
}));

jest.mock('app/core/services/backend_srv', () => {
  return {
    backendSrv: {
      search: async () =>
        Promise.resolve([
          { uid: 'test', value: 1, title: 'Test dashboard' },
          { uid: 'test-1', value: 3, title: 'Dashboard 1' },
          { uid: 'test-2', value: 2, title: 'Dashboard 2' },
        ]),
    },
  };
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    buildInfo: {
      edition: 'Enterprise',
      version: '9.0.0',
      commit: 'abc123',
      env: 'dev',
      latestVersion: '',
      hasUpdate: false,
      hideVersion: false,
    },
    licenseInfo: {
      enabledFeatures: { 'reports.email': true },
    },
    featureToggles: {
      accesscontrol: true,
    },
    rendererAvailable: true,
  },
}));

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      ...jest.requireActual('app/core/core').contextSrv,
      hasPermission: () => true,
    },
  };
});

const blankReport = initialState.report;
const testReport = {
  ...blankReport,
  id: 1,
  name: 'Test report',
  subject: 'Test subject report',
  dashboardId: 1,
  dashboardName: 'Test dashboard',
  dashboards: [
    {
      dashboard: {
        id: 1,
        uid: 'test',
        name: 'Test dashboard',
      },
      timeRange: { to: '', from: '' },
    },
  ],
  recipients: 'test@me.com',
};

const mockUpdate = mockToolkitActionCreator(updateReportProp);

const setup = (propOverrides?: Partial<Props>) => {
  addRootReducer(reportsReducers);
  const props: Props = {
    ...getRouteComponentProps(),
    report: blankReport,
    updateReportProp: mockToolkitActionCreator(updateReportProp),
    initVariables: jest.fn(),
    cleanUpVariables: jest.fn(),
    templating: {},
    ...propOverrides,
  };

  return render(<SelectDashboards {...props} />);
};

describe('SelectDashboard', () => {
  it('should render', async () => {
    setup();
    expect(await screen.findByText('1. Select dashboard')).toBeInTheDocument();
  });

  it('should not update the form if nothing was entered', async () => {
    const { user } = setup({ updateReportProp: mockUpdate });

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(mockUpdate).not.toBeCalled());
  });

  it('should show the available data', async () => {
    setup({ report: testReport });
    expect(await screen.findByText('Dashboards/Test dashboard')).toBeInTheDocument();
    expect(screen.getByText('Select time range')).toBeInTheDocument();
  });

  it('should show the entered data on returning from next step', async () => {
    setup({
      report: {
        ...blankReport,
        dashboards: [
          {
            dashboard: {
              uid: 'test',
              name: 'Test dashboard',
            },
            timeRange: { to: 'now', from: 'now-1h' },
          },
        ],
      },
    });
    expect(await screen.findByText('Dashboards/Test dashboard')).toBeInTheDocument();
    expect(screen.getByText('Last 1 hour')).toBeInTheDocument();
  });

  it('should save the selected dashboard', async () => {
    const { user } = setup({ updateReportProp: mockUpdate });
    expect(await screen.getByRole('combobox', { name: 'Source dashboard' })).toBeInTheDocument();
    // Select dashboard
    await selectOptionInTest(screen.getByRole('combobox', { name: 'Source dashboard' }), 'Dashboards/Test dashboard');

    // Select time range
    await user.click(screen.getByTestId(selectors.components.TimePicker.openButton));
    await user.click(screen.getByLabelText('Last 1 hour'));

    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        ...blankReport,
        dashboards: [
          {
            dashboard: {
              uid: 'test',
              name: 'Test dashboard',
            },
            reportVariables: {},
            timeRange: { to: 'now', from: 'now-1h' },
          },
        ],
      })
    );
  });

  it('should apply params from URL and save those values', async () => {
    windowSpy.mockImplementation(() => ({
      search: '&from=now-6h&to=now&db-uid=msRNFn-nz&db-id=1&db-name=Test%20dashboard',
    }));

    const { user } = setup({ updateReportProp: mockUpdate });

    expect(await screen.findByText('Dashboards/Test dashboard')).toBeInTheDocument();
    expect(screen.getByText('Last 6 hours')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        ...blankReport,
        dashboards: [
          {
            dashboard: {
              uid: 'msRNFn-nz',
              name: 'Test dashboard',
            },
            reportVariables: {},
            timeRange: { to: 'now', from: 'now-6h' },
          },
        ],
      })
    );
  });

  it('should preserve unchanged dashboard time ranges when modifying another dashboard', async () => {
    // Set up report with 2 dashboards with different time ranges
    const reportWith2Dashboards = {
      ...blankReport,
      dashboards: [
        {
          dashboard: {
            uid: 'test-1',
            name: 'Dashboard 1',
          },
          timeRange: { to: 'now', from: 'now-1h' }, // This should remain unchanged
          reportVariables: {},
        },
        {
          dashboard: {
            uid: 'test-2',
            name: 'Dashboard 2',
          },
          timeRange: { to: 'now', from: 'now-6h' }, // This will be modified
          reportVariables: {},
        },
      ],
    };

    const { user, rerender } = setup({
      report: reportWith2Dashboards,
      updateReportProp: mockUpdate,
    });

    // Verify both dashboards are displayed with their initial time ranges
    expect(await screen.findByText('Dashboards/Dashboard 1')).toBeInTheDocument();
    expect(await screen.findByText('Dashboards/Dashboard 2')).toBeInTheDocument();
    expect(screen.getByText('Last 1 hour')).toBeInTheDocument();
    expect(screen.getByText('Last 6 hours')).toBeInTheDocument();

    // Simulate navigation to next step then back
    rerender(
      <SelectDashboards
        report={reportWith2Dashboards}
        updateReportProp={mockUpdate}
        initVariables={jest.fn()}
        cleanUpVariables={jest.fn()}
        templating={{}}
      />
    );

    // Change the second dashboard's time range
    const timePickerButtons = screen.getAllByTestId(selectors.components.TimePicker.openButton);
    expect(timePickerButtons).toHaveLength(2);

    // Click on the second dashboard's time picker
    await user.click(timePickerButtons[1]);
    await user.click(screen.getByLabelText('Last 24 hours'));

    // Change time range for the second dashboard
    const updatedReport = {
      ...reportWith2Dashboards,
      dashboards: [
        reportWith2Dashboards.dashboards[0],
        {
          ...reportWith2Dashboards.dashboards[1],
          timeRange: { to: 'now', from: 'now-24h' },
        },
      ],
    };

    // Simulate navigation to next step then back again
    rerender(
      <SelectDashboards
        report={updatedReport}
        updateReportProp={mockUpdate}
        initVariables={jest.fn()}
        cleanUpVariables={jest.fn()}
        templating={{}}
      />
    );

    // Verify that both time ranges remain unchanged
    expect(await screen.findByText('Dashboards/Dashboard 1')).toBeInTheDocument();
    expect(await screen.findByText('Dashboards/Dashboard 2')).toBeInTheDocument();
    expect(screen.getByText('Last 1 hour')).toBeInTheDocument();
    expect(screen.getByText('Last 24 hours')).toBeInTheDocument();
  });
});
