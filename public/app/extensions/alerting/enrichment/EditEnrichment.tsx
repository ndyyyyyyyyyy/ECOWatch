import { skipToken } from '@reduxjs/toolkit/query';
import { useParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { useAppNotification } from 'app/core/copy/appNotification';
import { AlertingPageWrapper } from 'app/features/alerting/unified/components/AlertingPageWrapper';
import { stringifyErrorLike } from 'app/features/alerting/unified/utils/misc';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

import {
  AlertEnrichment,
  ReplaceAlertEnrichmentApiArg,
  generatedAPI,
} from '../../api/clients/alertenrichment/v1beta1/endpoints.gen';
import { enrichmentNav } from '../navigation';

import { AlertEnrichmentForm } from './form/AlertEnrichmentForm';
import { AlertEnrichmentFormData, getInitialFormData, formDataToEnrichmentSpec } from './form/form';
import { useEditEnrichmentNavModel } from './navigation';

function EditEnrichment() {
  const { enrichmentK8sName } = useParams<{ enrichmentK8sName: string }>();
  const pageNav: NavModelItem = useEditEnrichmentNavModel(enrichmentK8sName);

  const {
    data: enrichment,
    isLoading,
    error,
  } = generatedAPI.useGetAlertEnrichmentQuery(enrichmentK8sName ? { name: enrichmentK8sName } : skipToken);

  if (error) {
    return (
      <AlertingPageWrapper navId="alerting-admin" pageNav={pageNav}>
        <Alert severity="error" title={t('alerting.enrichment.load-error', 'Failed to load enrichment')}>
          {stringifyErrorLike(error)}
        </Alert>
      </AlertingPageWrapper>
    );
  }

  if (!isLoading && !enrichment) {
    return (
      <AlertingPageWrapper navId="alerting-admin" pageNav={pageNav}>
        <EntityNotFound entity="Alert Enrichment" />
      </AlertingPageWrapper>
    );
  }

  return (
    <AlertingPageWrapper navId="alerting-admin" pageNav={pageNav} isLoading={isLoading}>
      {enrichment && <ExistingEnrichmentForm enrichment={enrichment} />}
    </AlertingPageWrapper>
  );
}

function ExistingEnrichmentForm({ enrichment }: { enrichment: AlertEnrichment }) {
  const [replaceAlertEnrichment, { isLoading: isUpdating }] = generatedAPI.useReplaceAlertEnrichmentMutation();
  const notifyApp = useAppNotification();
  const { value: llmEnabled } = useAsync(isLLMPluginEnabled);

  const onCancel = () => {
    locationService.push(enrichmentNav.list);
  };

  const onSubmit = async (formData: AlertEnrichmentFormData) => {
    if (!enrichment.metadata) {
      notifyApp.error(t('alert-enrichment.metadata-error', 'Invalid enrichment metadata'));
      return;
    }

    const updatedEnrichment: AlertEnrichment = {
      metadata: { name: enrichment.metadata.name },
      spec: formDataToEnrichmentSpec(formData),
    };

    const apiArg: ReplaceAlertEnrichmentApiArg = {
      name: enrichment.metadata.name || '',
      alertEnrichment: updatedEnrichment,
    };

    try {
      await replaceAlertEnrichment(apiArg).unwrap();
      notifyApp.success(t('alert-enrichment.update-success', 'Alert enrichment updated successfully!'));
      // Redirect to enrichments list page after successful update
      locationService.push(enrichmentNav.list);
    } catch (err) {
      console.error('Failed to update alert enrichment:', err);
      notifyApp.error(t('alert-enrichment.update-error', 'Failed to update alert enrichment'), stringifyErrorLike(err));
    }
  };

  const editPayload = getInitialFormData(enrichment);
  return (
    <AlertEnrichmentForm
      onSubmit={onSubmit}
      onCancel={onCancel}
      editPayload={editPayload}
      isLoading={isUpdating}
      llmEnabled={!!llmEnabled}
    />
  );
}

export default EditEnrichment;
