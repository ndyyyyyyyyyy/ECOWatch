import { reportInteraction } from '@grafana/runtime';
import { AlertEnrichment } from 'app/extensions/api/clients/alertenrichment/v1beta1/endpoints.gen';

import { EnrichmentScope } from '../form/form';

import { getEnrichmentTrackingProps } from './utils';

// Alert Enrichment Analytics
export interface EnrichmentTrackingProps extends Record<string, unknown> {
  enricher_type?: string;
  has_label_matchers?: boolean;
  has_annotation_matchers?: boolean;
  steps_count?: number;
  scope_type?: EnrichmentScope;
  form_action?: 'create' | 'update';
}

/**
 * Track when user views the enrichments list
 */
export function trackEnrichmentListView(payload: { enrichments_count: number; has_enrichments: boolean }) {
  reportInteraction('grafana_alerting_enrichment_list_view', payload);
}

/**
 * Track when user loads more enrichments
 */
export function trackEnrichmentLoadMore(payload: { current_count: number }) {
  reportInteraction('grafana_alerting_enrichment_load_more', payload);
}

/**
 * Track enrichment creation started
 */
export function trackEnrichmentCreationStarted() {
  reportInteraction('grafana_alerting_enrichment_creation_started');
}

/**
 * Track successful enrichment creation/update
 */
export function trackEnrichmentSaved(payload: EnrichmentTrackingProps) {
  reportInteraction('grafana_alerting_enrichment_saved', payload);
}

/**
 * Track enrichment form errors
 */
export function trackEnrichmentFormError(payload: { form_action: 'create' | 'update'; error_field?: string }) {
  reportInteraction('grafana_alerting_enrichment_form_error', payload);
}

/**
 * Track enrichment deletion
 */
export function trackEnrichmentDeleted(enrichment: AlertEnrichment) {
  const trackingProps = getEnrichmentTrackingProps(enrichment);
  reportInteraction('grafana_alerting_enrichment_deleted', trackingProps);
}

/**
 * Track enrichment edit button clicked
 */
export function trackEnrichmentEditClicked(enrichment: AlertEnrichment) {
  const trackingProps = getEnrichmentTrackingProps(enrichment);
  reportInteraction('grafana_alerting_enrichment_edit_clicked', trackingProps);
}
