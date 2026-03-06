import { screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { render } from 'test/test-utils';

import { getDefaultTimeRange } from '@grafana/data';
import { ReportFormV2 } from 'app/extensions/types/reports';

import { getRange } from '../../../utils/time';
import { formSchemaValidationRules } from '../../utils/validation';

import { SendPreviewToggletip } from './SendPreviewToggletip';

const mockSendTestEmail = jest.fn().mockImplementation(() => ({
  unwrap: () => Promise.resolve(),
}));

jest.mock('app/extensions/api/clients/reporting', () => ({
  useSendTestEmailMutation: () => [mockSendTestEmail, { isLoading: false }],
}));

interface FormProviderWrapperProps {
  children: React.ReactNode;
  defaultValues?: Partial<ReportFormV2>;
}

function FormProviderWrapper({ children, defaultValues }: FormProviderWrapperProps) {
  const methods = useForm<ReportFormV2>({
    defaultValues: {
      title: 'Test',
      dashboards: [{ uid: '1', timeRange: getRange(getDefaultTimeRange()) }],
      ...defaultValues,
      recipients: defaultValues?.recipients || ['test@test.com', 'test2@test.com'],
    },
  });

  // Register inputs so they are available for validation
  methods.register('title', formSchemaValidationRules().title);
  methods.register('dashboards', formSchemaValidationRules().dashboards.uid);

  return <FormProvider {...methods}>{children}</FormProvider>;
}

function setup(defaultValues?: Partial<ReportFormV2>) {
  return render(
    <FormProviderWrapper defaultValues={defaultValues}>
      <SendPreviewToggletip sceneDashboards={[]} />
    </FormProviderWrapper>
  );
}

describe('SendPreviewToggletip', () => {
  beforeEach(() => {
    mockSendTestEmail.mockClear();
  });

  it('should render send preview button', () => {
    setup();
    expect(screen.getByText('Send preview')).toBeInTheDocument();
  });

  it('should not open toggletip when clicking the button with missing required fields', async () => {
    const { user } = setup({
      title: undefined,
      dashboards: [{ uid: undefined, timeRange: getDefaultTimeRange() }],
    });
    await user.click(screen.getByText('Send preview'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Use emails from report' })).not.toBeInTheDocument();
  });

  it('should open toggletip when clicking the button with valid fields', async () => {
    const { user } = setup();
    await user.click(screen.getByText('Send preview'));

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Use emails from report' })).toBeInTheDocument();
  });

  it('should show validation error for invalid email', async () => {
    const { user } = setup();
    await user.click(screen.getByText('Send preview'));
    const emailInput = screen.getByRole('textbox');

    await user.type(emailInput, 'invalid-email');
    await user.click(screen.getByText('Send'));

    expect(await screen.findByText('Invalid emails: invalid-email')).toBeInTheDocument();
  });

  it('should show required error when submitting empty form', async () => {
    const { user } = setup();
    await user.click(screen.getByText('Send preview'));
    await user.click(screen.getByText('Send'));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
  });

  it('should populate email field with recipients when using report emails', async () => {
    const { user } = setup();
    await user.click(screen.getByText('Send preview'));
    await user.click(screen.getByRole('checkbox'));

    const emailInput = screen.getByRole('textbox');
    expect(emailInput).toHaveValue('test@test.com, test2@test.com');
    expect(emailInput).toBeDisabled();
  });

  it('should clear email field when unchecking use report emails', async () => {
    const { user } = setup();
    await user.click(screen.getByText('Send preview'));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('checkbox'));

    const emailInput = screen.getByRole('textbox');
    expect(emailInput).toHaveValue('');
    expect(emailInput).not.toBeDisabled();
  });

  it('should submit form with valid email', async () => {
    const { user } = setup();
    await user.click(screen.getByText('Send preview'));
    const emailInput = screen.getByRole('textbox');

    await user.type(emailInput, 'valid@email.com');
    await user.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(mockSendTestEmail).toHaveBeenCalled();
      const call = mockSendTestEmail.mock.calls[0][0];
      expect(call.recipients).toBe('valid@email.com');
    });
  });

  it('should close toggletip when clicking cancel', async () => {
    const { user } = setup();
    await user.click(screen.getByText('Send preview'));
    await user.click(screen.getByText('Cancel'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('should submit form when pressing Enter in email field', async () => {
    const { user } = setup();
    await user.click(screen.getByText('Send preview'));
    const emailInput = screen.getByRole('textbox');

    await user.type(emailInput, 'valid@email.com{enter}');

    await waitFor(() => {
      expect(mockSendTestEmail).toHaveBeenCalled();
      const call = mockSendTestEmail.mock.calls[0][0];
      expect(call.recipients).toBe('valid@email.com');
    });
  });

  it('should disable checkbox when no recipients are available', async () => {
    const { user } = setup({ recipients: [] });
    await user.click(screen.getByText('Send preview'));
    const checkbox = screen.getByRole('checkbox');

    expect(checkbox).toBeDisabled();
  });
});
