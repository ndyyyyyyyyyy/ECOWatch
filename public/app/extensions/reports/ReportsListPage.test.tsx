import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryHistoryBuildOptions } from 'history';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render } from 'test/test-utils';

import { GrafanaEdition } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { addExtraMiddleware, addRootReducer } from 'app/store/configureStore';

import { reportingAPI } from '../api/clients/reporting';
import { Report, ReportFormat, ReportSchedulingFrequency, ReportState } from '../types';

import { ReportsListPage } from './ReportsListPage';
import { getRendererMajorVersion } from './utils/renderer';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

jest.mock('./UpsertReportDrawer', () => ({
  UpsertReportDrawer: () => <h1>UpsertReportDrawer content</h1>,
}));

config.licenseInfo = {
  enabledFeatures: { 'reports.creation': true },
  expiry: 0,
  licenseUrl: '',
  stateInfo: '',
  edition: GrafanaEdition.Enterprise,
};

config.buildInfo = {
  buildstamp: 12345,
  edition: GrafanaEdition.Enterprise,
  version: '9.0.0',
  versionString: '9.0.0',
  commit: 'abc123',
  commitShort: 'abc',
  env: 'dev',
  latestVersion: '',
  hasUpdate: false,
  hideVersion: false,
};

config.rendererAvailable = true;

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      ...jest.requireActual('app/core/core').contextSrv,
      hasPermission: () => true,
    },
  };
});

jest.mock('./utils/renderer', () => {
  return {
    getRendererMajorVersion: jest.fn(),
  };
});

const server = setupServer();

beforeEach(() => {
  server.use(
    http.get('/api/reports', () => HttpResponse.json([testReport])),
    http.get('/api/reports/settings', () =>
      HttpResponse.json({
        id: 1,
        userId: 4,
        orgId: 1,
        pdfTheme: 'light',
        embeddedImageTheme: 'dark',
        branding: {
          reportLogoUrl: '',
          emailFooterMode: 'sent-by',
        },
      })
    )
  );
});

afterEach(() => {
  jest.clearAllMocks();
  server.resetHandlers();
});

beforeAll(() => {
  addRootReducer({
    [reportingAPI.reducerPath]: reportingAPI.reducer,
  });
  addExtraMiddleware(reportingAPI.middleware);
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  server.close();
});

const setup = async (rendererMajorVersion: number | null, historyOptions?: MemoryHistoryBuildOptions) => {
  (getRendererMajorVersion as jest.Mock).mockReturnValue(rendererMajorVersion);
  render(<ReportsListPage />, { historyOptions });

  await waitFor(() => {
    expect(screen.queryByText(/loading .../i)).not.toBeInTheDocument();
  });
};

describe('ReportsListPage', () => {
  const warningMatcher = /using an old version of the image renderer/;

  it('should render a warning when the renderer version is too old', async () => {
    await setup(2);
    const header = screen.getByText(warningMatcher);

    expect(header).toBeInTheDocument();
  });

  it('should not render a warning when the renderer version is new enough', async () => {
    await setup(3);
    const header = screen.queryByText(warningMatcher);

    expect(header).not.toBeInTheDocument();
  });

  it('should not render a warning when the renderer version is unavailable', async () => {
    await setup(null);
    const header = screen.queryByText(warningMatcher);

    expect(header).not.toBeInTheDocument();
  });

  it('should render the list of reports when there are reports', async () => {
    await setup(3);
    expect(screen.queryByText('There are no reports created yet')).not.toBeInTheDocument();
    expect(screen.getByText('Test report')).toBeInTheDocument();
    expect(screen.getByText('1 recipient')).toBeInTheDocument();
    expect(screen.getByText('Test report')).toBeInTheDocument();
    expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
  });

  it('should render the empty page when there are no reports created yet', async () => {
    server.use(http.get('/api/reports', () => HttpResponse.json([])));

    await setup(3);
    expect(screen.getByText('There are no reports created yet')).toBeInTheDocument();
  });

  it('should render report settings drawer when query param reportView=settings', async () => {
    await setup(3, { initialEntries: ['/?reportView=settings'] });
    expect(await screen.findByText('Report template settings')).toBeInTheDocument();
  });

  it('should not render report form drawer when query param reportView=new but newShareReportDrawer is false', async () => {
    config.featureToggles.newShareReportDrawer = false;
    await setup(3, { initialEntries: ['/?reportView=new'] });
    expect(screen.queryByText('UpsertReportDrawer content')).not.toBeInTheDocument();
  });

  it('should render report form drawer when query param reportView=new', async () => {
    config.featureToggles.newShareReportDrawer = true;
    await setup(3, { initialEntries: ['/?reportView=new'] });
    expect(await screen.findByText('UpsertReportDrawer content')).toBeInTheDocument();
  });

  it('should not render report form drawer when query param reportId is provided but newShareReportDrawer is false', async () => {
    config.featureToggles.newShareReportDrawer = false;
    await setup(3, { initialEntries: ['/?reportId=1'] });
    expect(screen.queryByText('UpsertReportDrawer content')).not.toBeInTheDocument();
  });

  it('should render report form drawer when query param reportId is provided', async () => {
    config.featureToggles.newShareReportDrawer = true;
    await setup(3, { initialEntries: ['/?reportId=1'] });
    expect(await screen.findByText('UpsertReportDrawer content')).toBeInTheDocument();
  });

  it('renders SVG logo when remote URL is used', async () => {
    const user = userEvent.setup();
    await setup(3, { initialEntries: ['/?reportView=settings'] });

    await user.type(await screen.findByLabelText(/Company logo URL/i), 'https://example.com/logo.svg');
    expect(screen.queryByText('Invalid image')).not.toBeInTheDocument();
  });
});

const testReport: Report = {
  id: 0,
  name: 'Test report',
  subject: 'Test subject',
  recipients: 'test@example.com',
  replyTo: '',
  message: 'Hi, \nPlease find attached a PDF status report. If you have any questions, feel free to contact me!\nBest,',
  dashboardName: '',
  dashboards: [
    {
      dashboard: {
        uid: '7MeksYbmk',
        name: 'gdev dashboards/Alerting with TestData',
      },
      timeRange: {
        from: '',
        to: '',
      },
      reportVariables: {
        namefilter: ['TestData'],
      },
    },
  ],
  schedule: {
    frequency: ReportSchedulingFrequency.Never,
    timeZone: 'Europe/Helsinki',
  },
  state: ReportState.Scheduled,
  formats: [ReportFormat.PDF],
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
};
