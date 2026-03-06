import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import {
  SceneVariableSet,
  TestVariable,
  SceneDataLayerControls,
  SceneTimeRange,
  VariableValueSelectors,
} from '@grafana/scenes';

import { getDefaultTimeRange } from '../../../../../../packages/grafana-data/src/types/time';
import { testWithFeatureToggles } from '../../../../features/alerting/unified/test/test-utils';
import { ReportFormV2 } from '../../../types';

import Attachments from './Attachments';
import { SelectDashboardScene, SelectDashboardState } from './SelectDashboards/SelectDashboardScene';

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

// Mock wrapper component to provide form context
const AttachmentsWrapper = ({ dashboards }: { dashboards?: SelectDashboardScene[] }) => {
  const methods = useForm<ReportFormV2>({
    defaultValues: {
      pdfOptions: {
        orientation: 'landscape',
        layout: 'grid',
        scaleFactor: 1,
      },
    },
  });

  return (
    <FormProvider {...methods}>
      <Attachments
        open={true}
        onToggle={() => {}}
        dashboards={dashboards ?? [getSelectDashboardScene(), getSelectDashboardScene()]}
      />
    </FormProvider>
  );
};

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

describe('Attachments', () => {
  testWithFeatureToggles(['pdfTables']);

  it('should be collapsed by default', () => {
    render(<AttachmentsWrapper />);

    // The section title should be visible
    expect(screen.getByRole('button', { name: 'Attachments' })).toBeInTheDocument();

    // But the checkboxes should not be visible initially
    expect(screen.queryByRole('checkbox', { name: 'Attach the report as a PDF' })).not.toBeVisible();
  });

  it('should render attachment options when expanded', async () => {
    const user = userEvent.setup();
    render(<AttachmentsWrapper />);

    // Expand the section first
    const sectionButton = screen.getByRole('button', { name: 'Attachments' });
    await user.click(sectionButton);

    // Now the checkboxes should be visible
    expect(screen.getByRole('checkbox', { name: 'Attach the report as a PDF' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Attach a separate PDF of table data' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Attach a CSV file of table panel data' })).toBeInTheDocument();
  });

  it('should not display PDF format options when PDF is not selected', async () => {
    const user = userEvent.setup();
    render(<AttachmentsWrapper />);

    // Expand the section first
    const sectionButton = screen.getByRole('button', { name: 'Attachments' });
    await user.click(sectionButton);

    // PDF format options should not be visible
    expect(screen.queryByRole('heading', { name: 'PDF format' })).not.toBeInTheDocument();
  });

  it('should show PDF format options when PDF is selected', async () => {
    const user = userEvent.setup();
    render(<AttachmentsWrapper />);

    // Expand the section first
    const sectionButton = screen.getByRole('button', { name: 'Attachments' });
    await user.click(sectionButton);

    // Select the PDF checkbox
    const pdfCheckbox = screen.getByRole('checkbox', { name: 'Attach the report as a PDF' });
    await user.click(pdfCheckbox);

    // Now PDF format options should be visible
    expect(screen.getByRole('heading', { name: 'PDF format' })).toBeInTheDocument();
    expect(screen.getByText('Orientation')).toBeInTheDocument();
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Zoom scale')).toBeInTheDocument();

    // Check that the PDF-specific checkboxes are rendered
    expect(screen.getByRole('checkbox', { name: 'Combine all dashboards PDFs in one file' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show template variables in the header' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Include table data as PDF appendix' })).toBeInTheDocument();
  });

  it('should show PDF format options only with orientation when pdf tables is selected', async () => {
    const user = userEvent.setup();
    render(<AttachmentsWrapper />);

    // Expand the section first
    const sectionButton = screen.getByRole('button', { name: 'Attachments' });
    await user.click(sectionButton);

    // Select the PDF tables checkbox
    const pdfTablesCheckbox = screen.getByRole('checkbox', { name: 'Attach a separate PDF of table data' });
    await user.click(pdfTablesCheckbox);

    // Now PDF format options should be visible
    expect(screen.getByRole('heading', { name: 'PDF format' })).toBeInTheDocument();
    expect(screen.getByText('Orientation')).toBeInTheDocument();

    // These elements should NOT be present
    expect(screen.queryByText('Layout')).not.toBeInTheDocument();
    expect(screen.queryByText('Zoom scale')).not.toBeInTheDocument();

    // Check that the PDF-specific checkboxes are NOT rendered
    expect(screen.queryByRole('checkbox', { name: 'Combine all dashboards PDFs in one file' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Show template variables in the header' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Include table data as PDF appendix' })).not.toBeInTheDocument();
  });

  it('should not show "combine all dashboards PDF" when there is only one dashboard ', async () => {
    const user = userEvent.setup();
    render(<AttachmentsWrapper dashboards={[getSelectDashboardScene()]} />);

    // Expand the section first
    const sectionButton = screen.getByRole('button', { name: 'Attachments' });
    await user.click(sectionButton);

    // Select the PDF checkbox
    const pdfCheckbox = screen.getByRole('checkbox', { name: 'Attach the report as a PDF' });
    await user.click(pdfCheckbox);

    // Check that the PDF-specific checkboxes are rendered
    expect(screen.queryByRole('checkbox', { name: 'Combine all dashboards PDFs in one file' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show template variables in the header' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Include table data as PDF appendix' })).toBeInTheDocument();
  });

  it('should not show "show template variables in the header" when there are no variables', async () => {
    const user = userEvent.setup();
    render(
      <AttachmentsWrapper
        dashboards={[getSelectDashboardScene({ $variables: new SceneVariableSet({ variables: [] }) })]}
      />
    );

    // Expand the section first
    const sectionButton = screen.getByRole('button', { name: 'Attachments' });
    await user.click(sectionButton);

    // Select the PDF checkbox
    const pdfCheckbox = screen.getByRole('checkbox', { name: 'Attach the report as a PDF' });
    await user.click(pdfCheckbox);

    // Check that the PDF-specific checkboxes are rendered
    expect(screen.queryByRole('checkbox', { name: 'Show template variables in the header' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Include table data as PDF appendix' })).toBeInTheDocument();
  });

  it('should not display PDF tables format options when pdf tables FF is not enabled', async () => {
    const user = userEvent.setup();
    config.featureToggles['pdfTables'] = false;
    render(<AttachmentsWrapper />);

    // Expand the section first
    const sectionButton = screen.getByRole('button', { name: 'Attachments' });
    await user.click(sectionButton);

    // Select the PDF checkbox
    const pdfCheckbox = screen.getByRole('checkbox', { name: 'Attach the report as a PDF' });
    await user.click(pdfCheckbox);

    expect(screen.queryByRole('checkbox', { name: 'Attach a separate PDF of table data' })).not.toBeInTheDocument();

    // Now PDF format options should be visible
    expect(screen.getByRole('heading', { name: 'PDF format' })).toBeInTheDocument();
    expect(screen.getByText('Orientation')).toBeInTheDocument();
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Zoom scale')).toBeInTheDocument();

    // Check that the PDF-specific checkboxes are NOT rendered
    expect(screen.getByRole('checkbox', { name: 'Combine all dashboards PDFs in one file' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Show template variables in the header' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Include table data as PDF appendix' })).not.toBeInTheDocument();
  });
});
