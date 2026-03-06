import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useForm } from 'react-hook-form';
import { render } from 'test/test-utils';

import { ReportFormV2 } from '../../../types';

import Recipients from './Recipients';

// Mock component wrapper to provide form context
const RecipientsWrapper = () => {
  const methods = useForm<ReportFormV2>({
    defaultValues: {
      recipients: [],
    },
  });

  return (
    <FormProvider {...methods}>
      <Recipients open={true} onToggle={() => {}} />
    </FormProvider>
  );
};

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      ...jest.requireActual('app/core/core').contextSrv,
      hasPermission: () => true,
    },
  };
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('Recipients', () => {
  it('should render correctly', () => {
    render(<RecipientsWrapper />);

    // Check for section title and input field
    expect(screen.getByRole('button', { name: /recipients/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Type in the recipients' email addresses/i)).toBeInTheDocument();
  });

  it('should accept valid email addresses', async () => {
    const user = userEvent.setup();
    render(<RecipientsWrapper />);

    // Type and press enter
    const input = screen.getByPlaceholderText(/Type in the recipients/);
    await user.click(input); // Add this line to ensure focus
    await user.type(input, 'test@example.com');

    // Click the Add button instead of pressing Enter
    const addButton = screen.getByRole('button', { name: /add/i });
    await user.click(addButton);

    // Try more flexible matching approaches
    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    // No error message should be displayed
    expect(screen.queryByText(/Invalid email/)).not.toBeInTheDocument();
  });

  it('should show error for invalid email addresses', async () => {
    const user = userEvent.setup();
    render(<RecipientsWrapper />);

    const input = screen.getByPlaceholderText(/Type in the recipients/);
    await user.click(input);
    await user.type(input, 'invalid-email');

    const addButton = screen.getByRole('button', { name: /add/i });
    await user.click(addButton);

    expect(await screen.findByText(/Invalid email/)).toBeInTheDocument();
  });

  it('should handle multiple email addresses', async () => {
    const user = userEvent.setup();
    render(<RecipientsWrapper />);

    const input = screen.getByPlaceholderText(/Type in the recipients/);
    await user.click(input);
    await user.type(input, 'test1@example.com');

    const addButton = screen.getByRole('button', { name: /add/i });
    await user.click(addButton);

    await user.click(input);
    await user.type(input, 'test2@example.com');
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('test1@example.com')).toBeInTheDocument();
      expect(screen.getByText('test2@example.com')).toBeInTheDocument();
    });
  });

  it('should handle multiple email addresses separated by semicolon', async () => {
    const user = userEvent.setup();
    render(<RecipientsWrapper />);

    const input = screen.getByPlaceholderText(/Type in the recipients/);
    await user.click(input);
    await user.type(input, 'test1@example.com;test2@example.com');

    const addButton = screen.getByRole('button', { name: /add/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('test1@example.com')).toBeInTheDocument();
      expect(screen.getByText('test2@example.com')).toBeInTheDocument();
    });
  });

  it('should handle multiple email addresses separated by semicolon filtering invalid ones', async () => {
    const user = userEvent.setup();
    render(<RecipientsWrapper />);

    const input = screen.getByPlaceholderText(/Type in the recipients/);
    await user.click(input);
    await user.type(input, 'test1@example.com;test2@example.com;wrong1;wrong2');

    const addButton = screen.getByRole('button', { name: /add/i });
    await user.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('test1@example.com')).toBeInTheDocument();
      expect(screen.getByText('test2@example.com')).toBeInTheDocument();
      expect(screen.getByText(/Invalid emails: wrong1; wrong2/)).toBeInTheDocument();
    });
  });

  it('should filter out duplicate email addresses', async () => {
    const user = userEvent.setup();
    render(<RecipientsWrapper />);

    const input = screen.getByPlaceholderText(/Type in the recipients/);
    await user.click(input);
    await user.type(input, 'duplicate@example.com');

    const addButton = screen.getByRole('button', { name: /add/i });
    await user.click(addButton);

    await user.click(input);
    await user.type(input, 'duplicate@example.com');
    await user.click(addButton);

    // Should only show one tag
    const tags = screen.getAllByText('duplicate@example.com');
    expect(tags.length).toBe(1);
  });
});
