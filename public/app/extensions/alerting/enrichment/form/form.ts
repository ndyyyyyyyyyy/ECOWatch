import { t } from '@grafana/i18n';
import { ComboboxOption } from '@grafana/ui';
import {
  AlertEnrichment,
  AlertEnrichmentSpec,
  EnricherConfig,
  Matcher,
  Step,
} from 'app/extensions/api/clients/alertenrichment/v1beta1/endpoints.gen';

export type EnrichmentScope = 'global' | 'label' | 'annotation';

export interface AlertEnrichmentFormData {
  title: string;
  description?: string;
  steps: Step[];
  scope: EnrichmentScope;
  labelMatchers?: Matcher[];
  annotationMatchers?: Matcher[];
}

export type EnrichmentType = EnricherConfig['type'];

const DEFAULT_ENRICHMENT_TIMEOUT = '30s';

export function getInitialFormData(enrichment?: AlertEnrichment): AlertEnrichmentFormData {
  const scope = enrichment?.spec ? determineScope(enrichment.spec) : 'global';

  return {
    scope,
    title: enrichment?.spec?.title || '',
    description: enrichment?.spec?.description || '',
    steps: [
      enrichment?.spec?.steps?.[0] || {
        timeout: DEFAULT_ENRICHMENT_TIMEOUT,
        type: 'enricher',
        enricher: { type: 'assign', assign: { annotations: [] } },
      },
    ],
    labelMatchers: enrichment?.spec?.labelMatchers || [],
    annotationMatchers: enrichment?.spec?.annotationMatchers || [],
  };
}

export function getMatcherTypeOptions() {
  return [
    { label: t('alert-enrichment-form.matcher-type.equals', 'Equals (=)'), value: '=' },
    { label: t('alert-enrichment-form.matcher-type.not-equals', 'Not Equals (!=)'), value: '!=' },
    { label: t('alert-enrichment-form.matcher-type.regex-match', 'Regex Match (=~)'), value: '=~' },
    { label: t('alert-enrichment-form.matcher-type.regex-not-match', 'Regex Not Match (!~)'), value: '!~' },
  ];
}

export function getEnricherTypeOptions(): Array<ComboboxOption<EnrichmentType>> {
  return [
    { label: t('alert-enrichment-form.enricher-type.assign', 'Assign'), value: 'assign' },
    { label: t('alert-enrichment-form.enricher-type.external', 'External'), value: 'external' },
    { label: t('alert-enrichment-form.enricher-type.dsquery', 'Data Source Query'), value: 'dsquery' },
    { label: t('alert-enrichment-form.enricher-type.asserts', 'Asserts'), value: 'asserts' },
    { label: t('alert-enrichment-form.enricher-type.sift', 'Sift'), value: 'sift' },
    { label: t('alert-enrichment-form.enricher-type.explain', 'Explain'), value: 'explain' },
  ];
}

export function getDsTypeOptions() {
  return [
    { label: t('alert-enrichment-form.ds-type.logs', 'Logs'), value: 'logs' },
    { label: t('alert-enrichment-form.ds-type.raw', 'Raw'), value: 'raw' },
  ];
}

/**
 * Determines the scope of the enrichment based on the presence of matchers
 */
function determineScope(enrichmentSpec: AlertEnrichmentSpec): EnrichmentScope {
  if (enrichmentSpec.labelMatchers && enrichmentSpec.labelMatchers.length > 0) {
    return 'label';
  }
  if (enrichmentSpec.annotationMatchers && enrichmentSpec.annotationMatchers.length > 0) {
    return 'annotation';
  }
  return 'global';
}

/**
 * Processes AlertEnrichmentFormData and cleans it based on scope settings.
 * When scope is 'global' (all alerts), both labelMatchers and annotationMatchers are cleared.
 */
export function formDataToEnrichmentSpec(formData: AlertEnrichmentFormData): AlertEnrichmentSpec {
  const scope = formData.scope;

  return {
    title: formData.title,
    description: formData.description,
    steps: formData.steps,
    // Only save matchers for selected scope
    labelMatchers: scope === 'label' ? formData.labelMatchers : undefined,
    annotationMatchers: scope === 'annotation' ? formData.annotationMatchers : undefined,
  };
}
