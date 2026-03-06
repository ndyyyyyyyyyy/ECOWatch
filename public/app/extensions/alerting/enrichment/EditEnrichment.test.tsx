import { waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { byRole, byText } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';
import { addExtraMiddleware, addRootReducer } from 'app/store/configureStore';

import { render } from '../../../../test/test-utils';
import { alertEnrichmentAPIv1beta1 } from '../../api/clients/alertenrichment/v1beta1';
import { getAlertingEnterpriseRoutes } from '../index';

import EditEnrichment from './EditEnrichment';
import { setupEnrichmentMockServer } from './__mocks__/enrichmentApi';

jest.mock('app/features/dashboard/components/GenAI/utils');

const { apiConfig } = setupEnrichmentMockServer();

beforeAll(() => {
  addRootReducer({
    [alertEnrichmentAPIv1beta1.reducerPath]: alertEnrichmentAPIv1beta1.reducer,
  });
  addExtraMiddleware(alertEnrichmentAPIv1beta1.middleware);
});

const ui = {
  enrichmentNameInput: byRole('textbox', { name: /Enrichment Name/ }),
  descriptionInput: byRole('textbox', { name: /Description/ }),
  timeoutInput: byRole('textbox', { name: /Timeout/ }),
  saveButton: byRole('button', { name: 'Save Enrichment' }),
  cancelButton: byRole('button', { name: 'Cancel' }),
  successNotification: byRole('status', { name: 'Alert enrichment updated successfully!' }),
  errorNotification: byRole('alert', { name: 'Failed to update alert enrichment' }),
  loadingAlert: byRole('alert', { name: 'Failed to load enrichment' }),
  notFoundHeading: byText('Alert Enrichment not found'),
  explainEnricherWarning: byText(
    'Explain enricher uses LLM to generate explanations for alerts. Configure the annotation key where the explanation will be stored.'
  ),
  enricherTypeSelector: byRole('combobox', { name: /Enricher Type/ }),
};

function renderEditEnrichment(enrichmentName = 'test-enrichment') {
  // Use the actual enterprise route path to ensure tests match production
  const enterpriseRoutes = getAlertingEnterpriseRoutes();
  const editRoute = enterpriseRoutes.find((route) => route.path === '/alerting/admin/enrichment/:enrichmentK8sName');

  if (!editRoute) {
    throw new Error('Could not find EditEnrichment route in enterprise routes');
  }

  return render(
    <Routes>
      <Route
        path={editRoute.path}
        element={
          <>
            <EditEnrichment />
            <AppNotificationList />
          </>
        }
      />
    </Routes>,
    {
      renderWithRouter: true,
      historyOptions: { initialEntries: [`/alerting/admin/enrichment/${enrichmentName}`] },
    }
  );
}

describe('EditEnrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isLLMPluginEnabled).mockResolvedValue(true);
  });

  describe('Form Loading', () => {
    it('should populate form fields with API data after loading', async () => {
      renderEditEnrichment('test-enrichment');

      // Wait for form to render and be populated with API data
      const nameInput = await ui.enrichmentNameInput.find();

      expect(nameInput).toHaveValue('Enrichment test-enrichment');
      expect(ui.descriptionInput.get()).toHaveValue('Description for test-enrichment');
      expect(ui.timeoutInput.get()).toHaveValue('30s');

      expect(ui.saveButton.get()).toBeEnabled();
      expect(ui.cancelButton.get()).toBeEnabled();
    });

    it('should show error when enrichment does not exist', async () => {
      // Test with nonexistent enrichment name
      renderEditEnrichment('nonexistent');

      // Should show error message for 404 response
      await ui.loadingAlert.find();
      expect(ui.loadingAlert.get()).toHaveTextContent('Failed to load enrichment');
    });

    it('should handle LLM plugin disabled state', async () => {
      jest.mocked(isLLMPluginEnabled).mockResolvedValue(false);

      renderEditEnrichment();

      await ui.enrichmentNameInput.find();
      // Form should still render even when LLM is disabled
      expect(ui.enrichmentNameInput.get()).toBeInTheDocument();
    });

    it('should show explain enricher warning when explain type is selected', async () => {
      // Override the mock to return an enrichment with explain type
      apiConfig.mockGetEnrichment({
        metadata: { name: 'test-enrichment' },
        spec: {
          title: 'Enrichment test-enrichment',
          description: 'Description for test-enrichment',
          steps: [
            {
              timeout: '30s',
              type: 'enricher',
              enricher: { type: 'explain', explain: { annotation: 'explanation' } },
            },
          ],
        },
      });

      renderEditEnrichment();

      // Wait for form to load with explain enricher
      await ui.enrichmentNameInput.find();

      // Verify the explain enricher warning text is displayed
      expect(ui.explainEnricherWarning.get()).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('should allow typing in form fields', async () => {
      const { user } = renderEditEnrichment();

      await ui.enrichmentNameInput.find();

      // Verify form can be interacted with (clear existing values first since form is pre-populated)
      await user.clear(ui.enrichmentNameInput.get());
      await user.type(ui.enrichmentNameInput.get(), 'Test Enrichment Name');
      expect(ui.enrichmentNameInput.get()).toHaveValue('Test Enrichment Name');

      await user.clear(ui.descriptionInput.get());
      await user.type(ui.descriptionInput.get(), 'Test description');
      expect(ui.descriptionInput.get()).toHaveValue('Test description');

      await user.clear(ui.timeoutInput.get());
      await user.type(ui.timeoutInput.get(), '45s');
      expect(ui.timeoutInput.get()).toHaveValue('45s');
    });
  });

  describe('Navigation', () => {
    it('should navigate to enrichments list when cancel is clicked', async () => {
      const { user } = renderEditEnrichment();

      await ui.cancelButton.find();
      await user.click(ui.cancelButton.get());

      await waitFor(() => {
        expect(locationService.getLocation().pathname).toBe('/alerting/admin/enrichment');
      });
    });
  });
});
