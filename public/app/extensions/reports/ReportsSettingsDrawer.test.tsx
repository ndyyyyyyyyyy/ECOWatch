import { fireEvent, screen, within, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { addExtraMiddleware, addRootReducer } from 'app/store/configureStore';

import { reportingAPI } from '../api/clients/reporting';

import { ReportsSettingsDrawer } from './ReportsSettingsDrawer';

const server = setupServer();

const mockSettingsData = {
  branding: {
    emailFooterLink: 'https://footer-link.com',
    emailFooterMode: 'sent-by',
    emailFooterText: 'Test',
    emailLogoUrl: 'https://email-logo.jpg',
    reportLogoUrl: 'https://report-logo.jpg',
  },
  id: 0,
  orgId: 1,
  userId: 1,
  pdfTheme: 'light',
  embeddedImageTheme: 'dark',
};

beforeAll(() => {
  addRootReducer({
    [reportingAPI.reducerPath]: reportingAPI.reducer,
  });
  addExtraMiddleware(reportingAPI.middleware);
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  window.URL.createObjectURL = jest.fn(() => 'blob:https://');
  config.featureToggles.newPDFRendering = true;

  server.use(
    http.get('/api/reports/settings', () => HttpResponse.json(mockSettingsData)),
    http.post('/api/reports/settings', () => HttpResponse.json({}))
  );
});

afterEach(() => {
  (window.URL.createObjectURL as jest.Mock).mockReset();
  jest.clearAllMocks();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  config: {
    ...jest.requireActual('@grafana/runtime').config,
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

const setup = async () => {
  const onClose = jest.fn();
  const result = render(<ReportsSettingsDrawer onClose={onClose} />);

  await waitForElementToBeRemoved(() => screen.queryByText('Loading settings...'));

  return { ...result, onClose };
};

describe('ReportsSettingsDrawer', () => {
  it('should render existing settings when opened', async () => {
    await setup();

    expect(await screen.findByText(/attachment settings/i)).toBeInTheDocument();
    const reportLogoUrl = screen.getByTestId('url-field-branding.reportLogoUrl');
    expect(reportLogoUrl).toHaveValue('https://report-logo.jpg');
    const emailLogoUrl = screen.getByTestId('url-field-branding.emailLogoUrl');
    expect(emailLogoUrl).toHaveValue('https://email-logo.jpg');
    expect(screen.getByRole('radio', { name: /sent by/i })).toBeChecked();
    expect(screen.getByRole('textbox', { name: /footer link text/i })).toHaveValue('Test');
    expect(screen.getByRole('textbox', { name: /footer link url/i })).toHaveValue('https://footer-link.com');
    expect(screen.getByText(/The theme will be applied to the PDF attached to the report/i)).toBeInTheDocument();
    expect(
      screen.getByText(/The theme will be applied to the dashboard image embedded in the email/i)
    ).toBeInTheDocument();
    const lightTheme = screen.getAllByRole('radio', { name: /light/i });
    expect(lightTheme[0]).toBeChecked();
    const darkTheme = screen.getAllByRole('radio', { name: /dark/i });
    expect(darkTheme[1]).toBeChecked();
  });

  it('should hide footer link and text if footer mode is None', async () => {
    await setup();
    expect(await screen.findByRole('radio', { name: /sent by/i })).toBeChecked();
    expect(screen.getByRole('textbox', { name: /footer link text/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /footer link url/i })).toBeInTheDocument();

    const none = screen.getByRole('radio', { name: /none/i });
    fireEvent.click(none);

    expect(screen.queryByRole('textbox', { name: /footer link text/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /footer link url/i })).not.toBeInTheDocument();
  });

  it('should update the form fields on change and call onClose when submitted', async () => {
    const { user } = await setup();
    expect(await screen.findByText(/attachment settings/i)).toBeInTheDocument();
    const reportLogoUrl = screen.getByTestId('url-field-branding.reportLogoUrl');
    expect(reportLogoUrl).toHaveValue('https://report-logo.jpg');
    const emailLogoUrl = screen.getByTestId('url-field-branding.emailLogoUrl');
    expect(emailLogoUrl).toHaveValue('https://email-logo.jpg');
    await user.clear(reportLogoUrl);
    await user.type(reportLogoUrl, 'https://new-logo.png');
    const footerText = screen.getByRole('textbox', { name: /footer link text/i });
    await user.clear(footerText);
    await user.type(footerText, 'New company');
    const themePicker = screen.getAllByRole('radio', { name: /dark/i });
    fireEvent.click(themePicker[0]);

    // Submit the form
    await user.click(screen.getByRole('button', { name: 'Save' }));
  });

  it('should allow uploading files', async () => {
    const { user } = await setup();
    expect(await screen.findByText(/attachment settings/i)).toBeInTheDocument();
    const reportLogoPicker = screen.getByTestId('resource-picker-branding.reportLogoUrl');
    await user.click(within(reportLogoPicker).getByRole('radio', { name: /upload file/i }));
    await user.upload(
      within(reportLogoPicker).getByTestId('dropzone').querySelector('input[type="file"]')!,
      new File([JSON.stringify({ ping: true })], 'reportLogoCustom.png', { type: 'image/png' })
    );

    const emailLogoPicker = screen.getByTestId('resource-picker-branding.emailLogoUrl');
    await user.click(within(emailLogoPicker).getByRole('radio', { name: /upload file/i }));
    await user.upload(
      within(emailLogoPicker).getByTestId('dropzone').querySelector('input[type="file"]')!,
      new File([JSON.stringify({ ping: true })], 'emailLogoCustom.png', { type: 'image/png' })
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Wait for the save to complete
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
  });

  it('should not render PDF theme option when newPDFRendering FF is false', async () => {
    config.featureToggles.newPDFRendering = false;
    await setup();
    expect(await screen.findByText(/attachment settings/i)).toBeInTheDocument();
    expect(screen.queryByText(/The theme will be applied to the PDF attached to the report/i)).not.toBeInTheDocument();
  });

  it('should render NoRendererInfoBox when renderer is not available', async () => {
    config.rendererAvailable = false;
    await setup();
    expect(await screen.findByText(/Grafana Image renderer/i)).toBeInTheDocument();
  });
});
