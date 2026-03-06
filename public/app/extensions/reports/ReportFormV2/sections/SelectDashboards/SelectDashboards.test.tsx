import { act, screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { render } from 'test/test-utils';

import {
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  VariableValueSelectors,
  SceneDataLayerControls,
} from '@grafana/scenes';
import { ReportFormV2 } from 'app/extensions/types';

import { getDefaultTimeRange } from '../../../../../../../packages/grafana-data/src/types/time';

import { SelectDashboardScene, SelectDashboardState } from './SelectDashboardScene';
import SelectDashboards from './SelectDashboards';

jest.mock('app/core/core', () => {
  return {
    ...jest.requireActual('app/core/core'),
    contextSrv: {
      ...jest.requireActual('app/core/core').contextSrv,
      hasPermission: () => true,
    },
  };
});

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () => ({
    getDashboardDTO: jest.fn().mockResolvedValue({
      dashboard: {
        uid: 'test-dashboard',
        title: 'Test Dashboard',
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

const mockOnAddDashboard = jest.fn();
const mockOnRemoveDashboard = jest.fn();

const getSelectDashboardScene = (state?: Partial<SelectDashboardState>): SelectDashboardScene => {
  const varA = new TestVariable({ name: 'A', query: 'A.*', value: 'A.AA', text: '', options: [], delayMs: 0 });
  const timeRange = getDefaultTimeRange();

  return new SelectDashboardScene({
    uid: 'test-dashboard',
    title: 'Test Dashboard',
    $timeRange: new SceneTimeRange({
      timeZone: 'browser',
      from: timeRange.from.toISOString(),
      to: timeRange.to.toISOString(),
    }),
    $variables: new SceneVariableSet({ variables: [varA] }),
    variableControls: [new VariableValueSelectors({ layout: 'vertical' }), new SceneDataLayerControls()],
    ...state,
  });
};

const SelectDashboardsWrapper = ({ dashboards }: { dashboards?: SelectDashboardScene[] }) => {
  const methods = useForm<ReportFormV2>({
    defaultValues: {
      dashboards:
        dashboards?.map((d) => ({ uid: d.state.uid, key: d.state.key, timeRange: d.state.$timeRange?.state.value })) ||
        [],
    },
  });

  return (
    <FormProvider {...methods}>
      <SelectDashboards
        dashboards={dashboards || []}
        onAddDashboard={mockOnAddDashboard}
        open={true}
        onToggle={() => {}}
      />
    </FormProvider>
  );
};

async function setup(dashboards: SelectDashboardScene[] = []) {
  return await act(async () => render(<SelectDashboardsWrapper dashboards={dashboards} />));
}

describe('SelectDashboards', () => {
  it('should call onAddDashboard when clicking add button', async () => {
    const { user } = await setup();

    await user.click(screen.getByRole('button', { name: /add dashboard/i }));

    expect(mockOnAddDashboard).toHaveBeenCalled();
  });

  it('should call onRemoveDashboard with correct index when removing dashboard', async () => {
    const dashboards = [
      getSelectDashboardScene({
        uid: 'test-dashboard-1',
        title: 'Test Dashboard 1',
        onRemoveClick: mockOnRemoveDashboard,
      }),
      getSelectDashboardScene({ uid: 'test-dashboard-2', title: 'Test Dashboard 2' }),
    ];

    const { user } = await setup(dashboards);

    await user.click(screen.getAllByRole('button', { name: /delete this dashboard/i })[0]);

    expect(mockOnRemoveDashboard).toHaveBeenCalledWith(dashboards[0]);
  });

  it('should show template variables section when dashboard has variables', async () => {
    const varA = new TestVariable({ name: 'A', query: 'A.*', value: 'A.AA', text: '', options: [], delayMs: 0 });

    await setup([getSelectDashboardScene({ $variables: new SceneVariableSet({ variables: [varA] }) })]);

    expect(screen.getByText(/customize template variables/i)).toBeInTheDocument();
  });

  it('should show temp variables warning when same dashboard is added multiple times', async () => {
    const dashboards = Array(3)
      .fill(null)
      .map(() => getSelectDashboardScene());

    await setup(dashboards);

    const alerts = screen.getAllByText(/template variables that you selected first are applied to all instances/i);
    expect(alerts).toHaveLength(2);
  });
});
