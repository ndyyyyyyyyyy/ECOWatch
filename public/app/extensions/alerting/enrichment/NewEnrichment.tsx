import { useEffect } from 'react';
import { useAsync } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Stack } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { AlertingPageWrapper } from 'app/features/alerting/unified/components/AlertingPageWrapper';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

import {
  AlertEnrichment,
  CreateAlertEnrichmentApiArg,
  generatedAPI,
} from '../../api/clients/alertenrichment/v1beta1/endpoints.gen';
import { enrichmentNav } from '../navigation';

import { trackEnrichmentCreationStarted, trackEnrichmentSaved, trackEnrichmentFormError } from './analytics/Analytics';
import { getEnrichmentTrackingPropsFromFormData } from './analytics/utils';
import { AlertEnrichmentForm } from './form/AlertEnrichmentForm';
import { AlertEnrichmentFormData, formDataToEnrichmentSpec } from './form/form';
import { useNewEnrichmentNavModel } from './navigation';

function NewEnrichment() {
  const pageNav: NavModelItem = useNewEnrichmentNavModel();

  const [createAlertEnrichment, { isLoading }] = generatedAPI.useCreateAlertEnrichmentMutation();
  const notifyApp = useAppNotification();
  const { value: llmEnabled } = useAsync(isLLMPluginEnabled);

  // Track when the creation form is started
  useEffect(() => {
    trackEnrichmentCreationStarted();
  }, []);

  const onSubmit = async (formData: AlertEnrichmentFormData) => {
    const trackingProps = getEnrichmentTrackingPropsFromFormData(formData, 'create');
    const alertEnrichment: AlertEnrichment = {
      metadata: { generateName: 'enrichment-' },
      spec: formDataToEnrichmentSpec(formData),
    };

    const apiArg: CreateAlertEnrichmentApiArg = { alertEnrichment };

    try {
      await createAlertEnrichment(apiArg).unwrap();
      // Track successful creation
      trackEnrichmentSaved(trackingProps);

      notifyApp.success(t('alert-enrichment.success', 'Alert enrichment created successfully!'));
      // Redirect to enrichments list page after successful creation
      locationService.push(enrichmentNav.list);
    } catch (err) {
      // Track creation error
      trackEnrichmentFormError({ form_action: 'create', error_field: stringifyErrorLike(err) });
      console.error('Failed to create alert enrichment:', err);
      notifyApp.error(t('alert-enrichment.error', 'Failed to create alert enrichment'), stringifyErrorLike(err));
    }
  };

  const onCancel = () => {
    // Navigate back to enrichments list page
    locationService.push(enrichmentNav.list);
  };

  return (
    <AlertingPageWrapper navId="alerting-admin" pageNav={pageNav}>
      <Stack direction="column" gap={2}>
        <AlertEnrichmentForm onSubmit={onSubmit} onCancel={onCancel} isLoading={isLoading} llmEnabled={!!llmEnabled} />
      </Stack>
    </AlertingPageWrapper>
  );
}

export default NewEnrichment;
