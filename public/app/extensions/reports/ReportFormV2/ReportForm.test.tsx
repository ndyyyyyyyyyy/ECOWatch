import { screen, waitForElementToBeRemoved } from '@testing-library/react';
import { UserEvent } from '@testing-library/user-event';
import React from 'react';
import { render } from 'test/test-utils';

import { dateTime } from '@grafana/data';
import { getRange } from 'app/extensions/utils/time';

import { getDefaultTimeRange } from '../../../../../packages/grafana-data/src/types/time';
import { ReportSchedulingFrequencyV2, ReportState, ReportV2, SendTime } from '../../types';
import { selectors } from '../e2e-selectors/selectors';
import { getTimezone } from '../state/reducers';

import ReportForm from './ReportForm';
import { SectionId } from './sections/types';

// Mock DashboardPicker to prevent state updates
jest.mock('app/core/components/Select/DashboardPicker', () => ({
  DashboardPicker: React.forwardRef((props, ref) => <div data-testid="dashboard-picker" ref={ref as any} />),
}));

jest.mock('app/features/dashboard/state/DashboardModel', () => ({
  DashboardModel: jest.fn().mockImplementation((data, meta) => ({
    id: data.id,
    uid: data.uid,
    title: data.title,
    templating: { list: data.templating?.list || [] },
    timezone: data.timezone || '',
    weekStart: data.weekStart || '',
    fiscalYearStartMonth: data.fiscalYearStartMonth || 0,
    getVariables: () => [],
  })),
}));

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      ...jest.requireActual('app/core/core').contextSrv,
      hasPermission: () => true,
    },
  };
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  featureEnabled: () => true,
}));

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () => ({
    getDashboardDTO: jest.fn().mockResolvedValue({
      dashboard: {
        id: 2,
        uid: 'test-dashboard',
        title: 'Test Dashboard',
        templating: {
          list: [
            {
              current: {
                text: 'prometheus-utf8:9112',
                value: 'prometheus-utf8:9112',
              },
              name: 'query0',
              options: [
                {
                  selected: true,
                  text: 'prometheus-utf8:9112',
                  value: 'prometheus-utf8:9112',
                },
                {
                  selected: false,
                  text: 'another',
                  value: 'another',
                },
              ],
              query: 'prometheus-utf8:9112, another',
              type: 'custom',
            },
          ],
        },
        time: {
          from: 'now-6h',
          to: 'now',
        },
        panels: [],
      },
      meta: {
        folderTitle: 'Test Folder',
        folderUid: 'test-folder',
      },
    }),
  }),
}));

jest.mock('app/core/services/backend_srv', () => ({
  backendSrv: {
    search: jest.fn().mockResolvedValue([]),
  },
}));

const mockMutation = jest.fn().mockImplementation(() => ({
  unwrap: () => Promise.resolve(),
}));

const mockCreateReport = jest.fn().mockImplementation(() => ({
  unwrap: () => Promise.resolve(),
}));

jest.mock('app/extensions/api/clients/reporting', () => ({
  useCreateReportMutation: () => [mockCreateReport, { isLoading: false }],
  useSaveDraftReportMutation: () => [mockMutation, { isLoading: false }],
  useSendTestEmailMutation: () => [mockMutation, { isLoading: false }],
  useUpdateReportMutation: () => [mockMutation, { isLoading: false }],
  useUpdateStateReportMutation: () => [mockMutation, { isLoading: false }],
  useDeleteReportMutation: () => [mockMutation, { isLoading: false }],
}));

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  mockCreateReport.mockClear();
});

async function setup({
  report,
  setIsDirty = jest.fn(),
  defaultOpenSections,
}: {
  report?: Partial<ReportV2>;
  setIsDirty?: (isDirty: boolean) => void;
  defaultOpenSections?: Partial<Record<SectionId, boolean>>;
} = {}) {
  const updatedProps = {
    report: {
      title: 'Report name test',
      dashboards: [
        {
          uid: 'test-dashboard',
          timeRange: getRange(getDefaultTimeRange()),
        },
      ],
      ...report,
    },
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  const result = render(
    <ReportForm {...updatedProps} setIsDirty={setIsDirty} defaultOpenSections={defaultOpenSections} />
  );

  await waitForElementToBeRemoved(() => screen.queryByTestId('form-loading-placeholder'));
  return result;
}

describe('ReportForm render action buttons', () => {
  it('should render schedule and draft when report is new', async () => {
    await setup();

    // Check for action buttons
    expect(screen.getByRole('button', { name: /schedule report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send preview/i })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /update report/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('should render schedule and draft when report is draft', async () => {
    await setup({ report: { id: 1, state: ReportState.Draft } });

    // Check for action buttons
    expect(screen.getByRole('button', { name: /schedule report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send preview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /update report/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('should render update and pause when report is scheduled', async () => {
    await setup({ report: { id: 1, state: ReportState.Scheduled } });

    // Check for action buttons
    expect(screen.getByRole('button', { name: /update report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /schedule report/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument();
  });

  it('should render update and resume when report is paused', async () => {
    await setup({ report: { id: 1, state: ReportState.Paused } });

    // Check for action buttons
    expect(screen.getByRole('button', { name: /update report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /schedule report/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pause/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /safe draft/i })).not.toBeInTheDocument();
  });

  it('should disable resume button when state is paused and form is dirty', async () => {
    const { user } = await setup({ report: { id: 1, state: ReportState.Paused } });

    const titleInput = screen.getByRole('textbox', { name: 'Report name *' });
    await user.type(titleInput, 'New title to make the form dirty');

    const resumeButton = screen.getByRole('button', { name: /resume/i });
    expect(resumeButton).toBeInTheDocument();
    expect(resumeButton).toBeDisabled();
  });

  it('should disable pause button when state is scheduled and form is dirty', async () => {
    const { user } = await setup({
      report: { id: 1, state: ReportState.Scheduled },
    });

    const titleInput = screen.getByRole('textbox', { name: 'Report name *' });
    await user.type(titleInput, 'New title to make the form dirty');

    // Check for action buttons
    const pauseButton = screen.getByRole('button', { name: /pause/i });
    expect(pauseButton).toBeInTheDocument();
    expect(pauseButton).toBeDisabled();
  });
});

describe('ReportForm', () => {
  it('should render with sections and action buttons', async () => {
    await setup();

    expect(screen.getByRole('textbox', { name: 'Report name *' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dashboards/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email settings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recipients/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /attachments/i })).toBeInTheDocument();

    // Check for action buttons
    expect(screen.getByRole('button', { name: /schedule report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.ReportFormDrawer.actionsMenuButton)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send preview/i })).toBeInTheDocument();
  });

  it('should show validation error when submitting without required fields', async () => {
    const { user } = await setup({
      report: { title: undefined, dashboards: [{ uid: undefined, timeRange: getRange(getDefaultTimeRange()) }] },
    });

    await user.click(screen.getByRole('button', { name: /schedule report/i }));

    expect(await screen.findByText(/report name is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/dashboard is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/recipients are required/i)).toBeInTheDocument();

    expect(mockCreateReport).not.toHaveBeenCalled();
  });

  it('should handle form submission with valid data', async () => {
    const { user } = await setup();

    await user.type(screen.getByRole('textbox', { name: 'Report name *' }), 'Test Report');

    const recipientInput = screen.getByPlaceholderText(/Type in the recipients' email addresses/i);
    await user.type(recipientInput, 'test@example.com');
    await user.keyboard('{Enter}');

    await user.click(screen.getByRole('button', { name: /schedule report/i }));

    expect(mockCreateReport).toHaveBeenCalled();

    // Verify no validation errors are shown
    expect(screen.queryByText(/report name is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recipients are required/i)).not.toBeInTheDocument();
  });

  describe('Dashboards functionality', () => {
    it('should allow adding multiple dashboards', async () => {
      const { user } = await setup();

      // Add second dashboard
      await user.click(screen.getByRole('button', { name: /add dashboard/i }));
      const sourceDashboardInput = screen.getAllByText(/source dashboard/i);
      expect(sourceDashboardInput).toHaveLength(2);

      expect(screen.queryByRole('button', { name: /select time range/i })).not.toBeInTheDocument();
    });

    it('should not add a dashboard without uid but should add a default dashboard', async () => {
      const now = dateTime();
      await setup({
        report: {
          title: undefined,
          dashboards: [
            {
              uid: undefined,
              timeRange: getRange({
                from: dateTime(now).subtract(12, 'hour'),
                to: now,
                raw: { from: 'now-12h', to: 'now' },
              }),
            },
          ],
        },
      });

      const sourceDashboardInput = screen.queryAllByText(/source dashboard/i);
      expect(sourceDashboardInput).toHaveLength(1);
      expect(screen.getByText('Last 6 hours')).toBeInTheDocument();
    });

    it('time range should be empty if report has no time range', async () => {
      await setup({
        report: { title: 'Test dashboard', dashboards: [{ uid: 'test-dashboard', timeRange: { from: '', to: '' } }] },
      });

      expect(screen.getByText(/select time range/i)).toBeInTheDocument();
    });

    it('should allow removing dashboards', async () => {
      const { user } = await setup();

      expect(await screen.findAllByText(/source dashboard/i)).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: /add dashboard/i }));

      const removeButtons = screen.getAllByRole('button', { name: /delete this dashboard/i });
      await user.click(removeButtons[1]);

      // Verify the dashboard was removed
      const sourceDashboardInput = screen.getAllByText(/source dashboard/i);
      expect(sourceDashboardInput).toHaveLength(1);
    });

    it('should handle dashboard with variables correctly', async () => {
      await setup({
        report: {
          title: 'Dashboard with Variables',
          dashboards: [
            {
              uid: 'dashboard-with-vars',
              title: 'Dashboard with Variables',
              timeRange: getRange(getDefaultTimeRange()),
              variables: { query0: ['prometheus-utf8:9112', 'another'] },
            },
          ],
        },
      });

      // Verify variables section is present
      expect(screen.getByText(/customize template variables/i)).toBeInTheDocument();
    });

    it('should handle dashboard without variables correctly', async () => {
      const mockGetDashboardDTO = jest.fn().mockResolvedValue({
        dashboard: {
          id: 2,
          uid: 'test-dashboard',
          title: 'Test Dashboard',
          templating: {
            list: [],
          },
          time: {
            from: 'now-6h',
            to: 'now',
          },
          panels: [],
        },
        meta: {
          folderTitle: 'Test Folder',
          folderUid: 'test-folder',
        },
      });

      jest.spyOn(require('app/features/dashboard/api/dashboard_api'), 'getDashboardAPI').mockReturnValue({
        getDashboardDTO: mockGetDashboardDTO,
      });

      await setup({
        report: {
          title: 'Dashboard without Variables',
          dashboards: [
            {
              uid: 'dashboard-without-vars',
              title: 'Dashboard without Variables',
              timeRange: getRange(getDefaultTimeRange()),
            },
          ],
        },
      });

      // Verify no variables section is present
      expect(screen.queryByText(/customize template variables/i)).not.toBeInTheDocument();
    });
  });

  describe('Open sections when invalid fields', () => {
    const spec: Array<
      [
        string,
        {
          setupConfig?: { report?: Partial<ReportV2> };
          customBehavior?: (user: UserEvent) => Promise<void>;
          sectionButtonId: string;
          sectionContentId: string;
          assertErrorText: string;
        },
      ]
    > = [
      [
        'dashboard',
        {
          customBehavior: async (user) => {
            await user.click(screen.getByRole('button', { name: /add dashboard/i }));
          },

          sectionButtonId: selectors.components.ReportFormDrawer.SelectDashboards.header,
          sectionContentId: selectors.components.ReportFormDrawer.SelectDashboards.content,
          assertErrorText: 'dashboard is required',
        },
      ],
      [
        'schedule',
        {
          setupConfig: {
            report: {
              schedule: {
                sendTime: SendTime.Later,
                frequency: ReportSchedulingFrequencyV2.Daily,
                startDate: dateTime().add(1, 'day').startOf('day').toDate(),
                endDate: dateTime().toDate(),
                endTime: dateTime(),
                startTime: dateTime().add(1, 'hour').startOf('hour'),
                timeZone: getTimezone(),
              },
            },
          },

          sectionButtonId: selectors.components.ReportFormDrawer.Schedule.header,
          sectionContentId: selectors.components.ReportFormDrawer.Schedule.content,
          assertErrorText: 'end date must be greater or equal to start date',
        },
      ],
      [
        'email configuration',
        {
          setupConfig: {
            report: { replyTo: 'invalid-email' },
          },

          sectionButtonId: selectors.components.ReportFormDrawer.EmailConfiguration.header,
          sectionContentId: selectors.components.ReportFormDrawer.EmailConfiguration.content,
          assertErrorText: 'invalid email',
        },
      ],
      [
        'recipients',
        {
          setupConfig: {
            report: { recipients: [] },
          },

          sectionButtonId: selectors.components.ReportFormDrawer.Recipients.header,
          sectionContentId: selectors.components.ReportFormDrawer.Recipients.content,
          assertErrorText: 'recipients are required',
        },
      ],
    ];
    it.each(spec)('should open %s section when invalid fields', async (_, testConfig) => {
      const { setupConfig, sectionButtonId, sectionContentId, assertErrorText } = testConfig;
      const { user } = await setup({
        ...setupConfig,
        defaultOpenSections: {
          [SectionId.SelectDashboards]: false,
          [SectionId.Schedule]: false,
          [SectionId.EmailConfiguration]: false,
          [SectionId.Recipients]: false,
          [SectionId.Attachments]: false,
        },
      });

      const buttonSection = screen.getByTestId(sectionButtonId);

      await user.click(buttonSection);

      testConfig.customBehavior?.(user);

      const childContent = screen.getByTestId(sectionContentId);
      expect(childContent).toBeVisible();
      await user.click(buttonSection);
      expect(childContent).not.toBeVisible();

      await user.click(screen.getByRole('button', { name: /schedule report/i }));

      expect(childContent).toBeVisible();
      expect(await screen.findByText(new RegExp(assertErrorText, 'i'))).toBeVisible();

      expect(mockCreateReport).not.toHaveBeenCalled();
    });
  });
});
