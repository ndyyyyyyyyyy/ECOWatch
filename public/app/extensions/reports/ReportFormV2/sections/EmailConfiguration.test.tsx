import { screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { render } from 'test/test-utils';

import { SceneTimeRange, SceneVariableSet, TestVariable } from '@grafana/scenes';

import { DashboardScene } from '../../../../features/dashboard-scene/scene/DashboardScene';
import { ReportFormV2 } from '../../../types';

import EmailConfiguration from './EmailConfiguration';

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      ...jest.requireActual('app/core/core').contextSrv,
      hasPermission: () => true,
    },
  };
});

const EmailConfigurationWrapper = ({ report }: { report?: Partial<ReportFormV2> }) => {
  const varA = new TestVariable({ name: 'A', query: 'A.*', value: 'A.AA', text: '', options: [], delayMs: 0 });
  const dashboard = new DashboardScene({
    uid: 'test-dashboard',
    title: 'Test Dashboard',
    $timeRange: new SceneTimeRange({
      timeZone: 'browser',
    }),
    $variables: new SceneVariableSet({ variables: [varA] }),
  });

  const methods = useForm<ReportFormV2>({
    defaultValues: {
      title: 'Report name test',
      dashboards: [{ uid: dashboard.state.uid, key: dashboard.state.key }],
      ...report,
    },
  });

  return (
    <FormProvider {...methods}>
      <EmailConfiguration open={true} onToggle={() => {}} />
    </FormProvider>
  );
};

function setup(report: Partial<ReportFormV2>) {
  return render(<EmailConfigurationWrapper report={report} />);
}

describe('EmailConfiguration', () => {
  it('should render', async () => {
    const { user } = setup({});

    const emailConfigurationSection = screen.getByRole('button', { name: /email settings/i });
    expect(emailConfigurationSection).toBeInTheDocument();

    await user.click(emailConfigurationSection);

    expect(await screen.findByRole('textbox', { name: /email subject/i })).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: /message/i })).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: /reply-to-email address/i })).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: /include dashboard link/i })).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: /embed dashboard image/i })).toBeInTheDocument();
  });
});
