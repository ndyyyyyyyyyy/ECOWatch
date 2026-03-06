import { waitFor } from '@testing-library/react';
import { byRole } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';
import { addExtraMiddleware, addRootReducer } from 'app/store/configureStore';

import { render } from '../../../../test/test-utils';
import { alertEnrichmentAPIv1beta1 } from '../../api/clients/alertenrichment/v1beta1';

import NewEnrichment from './NewEnrichment';
import { setupEnrichmentMockServer } from './__mocks__/enrichmentApi';

jest.mock('app/features/dashboard/components/GenAI/utils');

const { apiConfig: configure } = setupEnrichmentMockServer();

beforeAll(() => {
  addRootReducer({
    [alertEnrichmentAPIv1beta1.reducerPath]: alertEnrichmentAPIv1beta1.reducer,
  });
  addExtraMiddleware(alertEnrichmentAPIv1beta1.middleware);
});

const ui = {
  enrichmentNameInput: byRole('textbox', { name: /Enrichment Name/ }),
  saveButton: byRole('button', { name: 'Save Enrichment' }),
  cancelButton: byRole('button', { name: 'Cancel' }),
  successNotification: byRole('status', { name: 'Alert enrichment created successfully!' }),
  errorNotification: byRole('alert', { name: 'Failed to create alert enrichment' }),
};

function renderEnrichment() {
  return render(
    <>
      <NewEnrichment />
      <AppNotificationList />
    </>,
    {
      renderWithRouter: true,
      historyOptions: { initialEntries: ['/alerting/admin/enrichment/new'] },
    }
  );
}

describe('NewEnrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isLLMPluginEnabled).mockResolvedValue(true);
  });

  describe('Form Submission', () => {
    it('should submit form data via API and navigate to enrichments list on success', async () => {
      const { user } = renderEnrichment();

      await user.type(await ui.enrichmentNameInput.find(), 'Test Integration Enrichment');
      await user.click(ui.saveButton.get());

      await ui.successNotification.find();
      await waitFor(() => {
        expect(locationService.getLocation().pathname).toBe('/alerting/admin/enrichment');
      });
    });

    it('should show error notification and stay on page when API fails', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      configure.mockCreateError(500, 'Server error');

      const { user } = renderEnrichment();

      await user.type(await ui.enrichmentNameInput.find(), 'Test Integration Enrichment');
      await user.click(ui.saveButton.get());

      await ui.errorNotification.find();
      expect(locationService.getLocation().pathname).toBe('/alerting/admin/enrichment/new');
    });
  });

  describe('Navigation', () => {
    it('should navigate to enrichments list when cancel is clicked', async () => {
      const { user } = renderEnrichment();

      await user.click(await ui.cancelButton.find());

      await waitFor(() => {
        expect(locationService.getLocation().pathname).toBe('/alerting/admin/enrichment');
      });
    });
  });
});
