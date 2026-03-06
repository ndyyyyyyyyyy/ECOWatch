import { screen, act, waitForElementToBeRemoved } from '@testing-library/react';
import { MemoryHistoryBuildOptions } from 'history';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render, userEvent } from 'test/test-utils';

import { EventBusSrv } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { featureEnabled, setPluginImportUtils } from '@grafana/runtime';
import { VizPanel, SceneTimeRange } from '@grafana/scenes';
import appEvents from 'app/core/app_events';
import { backendSrv } from 'app/core/services/backend_srv';
import { reportingAPI } from 'app/extensions/api/clients/reporting';
import { highlightTrial } from 'app/features/admin/utils';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';
import { addExtraMiddleware, addRootReducer } from 'app/store/configureStore';

import { selectors } from '../e2e-selectors/selectors';

import { ShareReport, ShareReportState } from './ShareReport';

const testEventBus = new EventBusSrv();
testEventBus.publish = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  featureEnabled: jest.fn(),
  reportInteraction: jest.fn(),
  getBackendSrv: () => backendSrv,
}));

jest.mock('../../../features/admin/utils', () => ({
  ...jest.requireActual('app/features/admin/utils'),
  highlightTrial: jest.fn(),
}));

jest.mock('../ReportFormV2/ReportForm', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid={selectors.components.ReportFormDrawer.container}>Report Form Mock</div>
    )),
}));

const server = setupServer();

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

const renderComponent = async (
  props: Partial<ShareReportState> = {},
  renderList = true,
  historyOptions?: MemoryHistoryBuildOptions
) => {
  const shareReport = new ShareReport({ ...props });

  const panel = new VizPanel({
    title: 'Panel A',
    pluginId: 'table',
    key: 'panel-12',
  });

  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    meta: {
      canEdit: true,
    },
    $timeRange: new SceneTimeRange({}),
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
    overlay: shareReport,
  });

  shareReport.activate();
  activateFullSceneTree(scene);

  const user = userEvent.setup({ delay: null });
  const result = await act(async () =>
    render(
      <shareReport.Component model={shareReport} />,

      {
        historyOptions: { initialEntries: historyOptions?.initialEntries ?? ['/?shareView=report'] },
      }
    )
  );

  jest.advanceTimersByTime(100);

  if (renderList) {
    await waitForElementToBeRemoved(() => screen.queryByText('Loading reports...'));
  }

  return {
    ...result,
    user,
    shareReport,
  };
};

beforeEach(() => {
  jest.useFakeTimers();

  (featureEnabled as jest.Mock).mockReturnValue(true);
  (highlightTrial as jest.Mock).mockReturnValue(false);
  jest.spyOn(appEvents, 'publish');
  server.use(
    http.get(
      '/api/reports/dashboards/:dashboardUid',
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(HttpResponse.json([]));
          }, 100);
        })
    )
  );
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
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

const testReport = {
  id: 128,
  uid: 'fekqwai1txcsga',
  userId: 1,
  orgId: 1,
  name: 'Dashboard 2 with table data',
  subject: '',
  recipients: '',
  replyTo: '',
  message: 'Hi, \nPlease find attached a PDF status report. If you have any questions, feel free to contact me!\nBest,',
  schedule: {
    startDate: '2025-05-05T18:04:42-03:00',
    endDate: null,
    frequency: 'once',
    intervalFrequency: '',
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
  enableCsv: false,
  state: 'draft',
  dashboards: [
    {
      dashboard: {
        id: 28,
        uid: 'edediimbjhdz4b',
        name: 'A tall dashboard',
      },
      timeRange: {
        from: 'now-6h',
        to: 'now',
      },
      reportVariables: {},
    },
  ],
  formats: [],
  scaleFactor: 0,
  created: '2025-05-05T18:05:42-03:00',
  updated: '2025-05-05T18:05:42-03:00',
};

describe('ShareReport', () => {
  describe('Reports list section', () => {
    it('should render the reports list', async () => {
      server.use(
        http.get(
          '/api/reports/dashboards/:dashboardUid',
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve(HttpResponse.json([testReport]));
              }, 100);
            })
        )
      );
      await renderComponent(undefined);
      expect(screen.getByRole('button', { name: 'Create a new report' })).toBeInTheDocument();
      expect(await screen.findByTestId(selectors.components.ReportsList.container)).toBeInTheDocument();
    });

    it('should render empty page when there are no reports', async () => {
      await renderComponent(undefined);
      expect(screen.getByText('There are no reports for this dashboard')).toBeInTheDocument();
    });

    it('should render a warning when report creation is disabled and still show the list', async () => {
      (featureEnabled as jest.Mock).mockImplementation((feature: string) => {
        return feature !== 'reports.creation';
      });
      server.use(
        http.get(
          '/api/reports/dashboards/:dashboardUid',
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve(HttpResponse.json([testReport]));
              }, 100);
            })
        )
      );

      await renderComponent(undefined, false);
      expect(
        await screen.findByText(/Creating new reports is not available with an expired license/)
      ).toBeInTheDocument();
      expect(await screen.findByTestId(selectors.components.ReportsList.container)).toBeInTheDocument();
    });
  });

  describe('Report form section', () => {
    it('should render the new drawer content when reports creation is enabled without highlight trial', async () => {
      (featureEnabled as jest.Mock).mockImplementation((feature: string) => {
        return feature === 'reports.creation';
      });
      await renderComponent(undefined, false, { initialEntries: ['/?shareView=report&reportView=new'] });

      expect(screen.queryByText('Learn more')).not.toBeInTheDocument();
      expect(screen.queryByText('Get started with reporting')).not.toBeInTheDocument();
    });

    it('should render the new drawer content when reports creation is enabled with highlight trial', async () => {
      (highlightTrial as jest.Mock).mockReturnValue(true);

      await renderComponent(undefined, false, { initialEntries: ['/?shareView=report&reportView=new'] });
      expect(await screen.findByTestId(selectors.components.ReportFormDrawer.container)).toBeInTheDocument();
      expect(screen.queryByText('Learn more')).toBeInTheDocument();
      expect(screen.queryByText('Get started with reporting')).toBeInTheDocument();
    });

    it('should render the new drawer content when query param reportView=new', async () => {
      await renderComponent(undefined, false, { initialEntries: ['/?shareView=report&reportView=new'] });

      expect(await screen.queryByTestId(selectors.components.ReportsList.container)).not.toBeInTheDocument();
      expect(await screen.findByTestId(selectors.components.ReportFormDrawer.container)).toBeInTheDocument();
    });

    it('should render the new drawer content when query param reportId is present', async () => {
      server.use(
        http.get(
          '/api/reports/:reportId',
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve(HttpResponse.json(testReport));
              }, 100);
            })
        )
      );

      await renderComponent(undefined, false, { initialEntries: ['/?shareView=report&reportId=123'] });
      expect(await screen.queryByTestId(selectors.components.ReportsList.container)).not.toBeInTheDocument();
      expect(await screen.findByTestId(selectors.components.ReportFormDrawer.container)).toBeInTheDocument();
    });
  });
});
