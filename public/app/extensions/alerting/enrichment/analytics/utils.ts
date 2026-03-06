import { AlertEnrichment } from 'app/extensions/api/clients/alertenrichment/v1beta1/endpoints.gen';

import { AlertEnrichmentFormData, EnrichmentScope } from '../form/form';

import { EnrichmentTrackingProps } from './Analytics';

export const getEnrichmentTrackingProps = (enrichment: AlertEnrichment): EnrichmentTrackingProps => {
  const spec = enrichment.spec;
  const enricherType = spec?.steps?.[0]?.enricher?.type;
  const hasLabelMatchers = (spec?.labelMatchers?.length ?? 0) > 0;
  const hasAnnotationMatchers = (spec?.annotationMatchers?.length ?? 0) > 0;
  const stepsCount = spec?.steps?.length ?? 0;

  let scopeType: EnrichmentScope = 'global';
  if (hasLabelMatchers) {
    scopeType = 'label';
  } else if (hasAnnotationMatchers) {
    scopeType = 'annotation';
  }

  return {
    enricher_type: enricherType,
    has_label_matchers: hasLabelMatchers,
    has_annotation_matchers: hasAnnotationMatchers,
    steps_count: stepsCount,
    scope_type: scopeType,
  };
};

export const getEnrichmentTrackingPropsFromFormData = (
  formData: AlertEnrichmentFormData,
  formAction: 'create' | 'update'
): EnrichmentTrackingProps => {
  const enricherType = formData.steps?.[0]?.enricher?.type;
  const hasLabelMatchers = (formData.labelMatchers?.length ?? 0) > 0;
  const hasAnnotationMatchers = (formData.annotationMatchers?.length ?? 0) > 0;
  const stepsCount = formData.steps?.length ?? 0;

  return {
    enricher_type: enricherType,
    has_label_matchers: hasLabelMatchers,
    has_annotation_matchers: hasAnnotationMatchers,
    steps_count: stepsCount,
    scope_type: formData.scope,
    form_action: formAction,
  };
};
