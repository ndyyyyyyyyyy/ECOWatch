import { useMemo } from 'react';
import {
  useForm,
  useFieldArray,
  Controller,
  FieldArrayWithId,
  FormProvider,
  useFormContext,
  useWatch,
} from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, Input, Combobox, IconButton, Stack, TextArea, Box, RadioButtonGroup, Alert } from '@grafana/ui';

import { Matcher } from '../../../api/clients/alertenrichment/v1beta1/endpoints.gen';

import { AssignEnricherConfig } from './AssignEnricherConfig';
import { ExplainEnricherConfig } from './ExplainEnricherConfig';
import { ExternalEnricherConfig } from './ExternalEnricherConfig';
import { GenericEnricherConfig } from './GenericEnricherConfig';
import { QueryEnricherConfig } from './QueryEnricherConfig';
import {
  getEnricherTypeOptions,
  getMatcherTypeOptions,
  AlertEnrichmentFormData,
  getInitialFormData,
  EnrichmentScope,
} from './form';

interface AlertEnrichmentFormProps {
  onSubmit: (data: AlertEnrichmentFormData) => void;
  onCancel: () => void;
  editPayload?: AlertEnrichmentFormData;
  isLoading?: boolean;
  llmEnabled?: boolean;
}

export function AlertEnrichmentForm({
  onSubmit,
  onCancel,
  editPayload,
  isLoading = false,
  llmEnabled = false,
}: AlertEnrichmentFormProps) {
  const form = useForm<AlertEnrichmentFormData>({
    defaultValues: {
      ...getInitialFormData(),
      ...editPayload,
    },
  });

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = form;

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack direction="column" gap={3}>
          <Stack direction="column" gap={2}>
            <Field label={t('alert-enrichment-form.basic-info.name', 'Enrichment Name')} noMargin htmlFor="title">
              <Input
                {...register('title', {
                  required: t('alert-enrichment-form.basic-info.name-required', 'Name is required'),
                })}
                placeholder={t('alert-enrichment-form.basic-info.name-placeholder', 'my-enrichment')}
                invalid={!!errors.title}
                id="title"
              />
            </Field>

            <Field
              label={t('alert-enrichment-form.basic-info.description', 'Description (Optional)')}
              noMargin
              htmlFor="description"
            >
              <TextArea
                {...register('description')}
                placeholder={t(
                  'alert-enrichment-form.basic-info.description-placeholder',
                  'Description of the enrichment'
                )}
                rows={2}
                id="description"
              />
            </Field>

            <Field
              label={t('alert-enrichment-form.basic-info.timeout', 'Timeout')}
              noMargin
              description={t(
                'alert-enrichment-form.basic-info.timeout-description',
                'Maximum time allowed for this enrichment (e.g., 30s, 1m)'
              )}
              htmlFor="steps.0.timeout"
            >
              <Input
                {...register('steps.0.timeout')}
                placeholder={t('alert-enrichment-form.basic-info.timeout-placeholder', '30s')}
                id="steps.0.timeout"
              />
            </Field>
          </Stack>

          <EnricherConfigSection llmEnabled={llmEnabled} />

          <ScopeSection />

          {/* Form Actions */}
          <Stack direction="row" gap={1}>
            <Button type="submit" variant="primary" disabled={isLoading}>
              <Trans i18nKey="alert-enrichment-form.actions.save" defaults="Save Enrichment" />
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
              <Trans i18nKey="alert-enrichment-form.actions.cancel" defaults="Cancel" />
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}

function EnricherConfigSection({ llmEnabled }: { llmEnabled: boolean }) {
  const enricherTypeOptions = useMemo(() => getEnricherTypeOptions(), []);

  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<AlertEnrichmentFormData>();
  const enricherType = useWatch({ control, name: 'steps.0.enricher.type' });

  const renderEnricherConfig = () => {
    switch (enricherType) {
      case 'assign':
        return <AssignEnricherConfig stepPath="steps.0" />;
      case 'external':
        return <ExternalEnricherConfig stepPath="steps.0" />;
      case 'dsquery':
        return <QueryEnricherConfig stepPath="steps.0" />;
      case 'asserts':
        return <GenericEnricherConfig enricherType="asserts" stepPath="steps.0" />;
      case 'sift':
        return <GenericEnricherConfig enricherType="sift" stepPath="steps.0" />;
      case 'explain':
        return <ExplainEnricherConfig stepPath="steps.0" />;
      default:
        return null;
    }
  };

  const showNoLLMWarning = !llmEnabled && enricherType === 'explain';

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={2}>
        <Field
          label={t('alert-enrichment-form.enricher-config.type', 'Enricher Type')}
          required
          noMargin
          htmlFor="steps.0.enricher.type"
        >
          <Controller
            name="steps.0.enricher.type"
            control={control}
            rules={{
              required: t('alert-enrichment-form.enricher-config.type-required', 'Enricher type is required'),
            }}
            render={({ field: { ref, ...field } }) => (
              <Combobox
                {...field}
                id="steps.0.enricher.type"
                options={enricherTypeOptions}
                placeholder={t('alert-enrichment-form.enricher-config.type-placeholder', 'Select enricher type')}
                invalid={!!errors.steps?.[0]?.enricher?.type}
                onChange={({ value }) => {
                  // Reset the enricher config when the type changes
                  const enricherConfig: any = { type: value };

                  // Special handling for dsquery which uses dataSource property
                  if (value === 'dsquery') {
                    enricherConfig.dataSource = {
                      type: 'raw',
                      raw: {
                        request: { queries: [] },
                        refId: 'A',
                      },
                    };
                  } else {
                    enricherConfig[value] = {};
                  }

                  setValue('steps.0.enricher', enricherConfig);
                }}
              />
            )}
          />
        </Field>
        {showNoLLMWarning && (
          <Alert
            severity="warning"
            title={t('alert-enrichment-form.enricher-config.llm-disabled', 'LLM is disabled')}
            bottomSpacing={0}
          >
            <Trans i18nKey="alert-enrichment-form.enricher-config.llm-disabled-description">
              Explain enricher requires Grafana LLM plugin to be enabled
            </Trans>
          </Alert>
        )}
        {renderEnricherConfig()}
      </Stack>
    </Stack>
  );
}

const getScopeOptions = (): Array<SelectableValue<EnrichmentScope>> => [
  { label: t('alert-enrichment-form.scope.all-alerts', 'All alerts'), value: 'global' },
  { label: t('alert-enrichment-form.scope.label-scoped', 'Label scoped'), value: 'label' },
  { label: t('alert-enrichment-form.scope.annotation-scoped', 'Annotation scoped'), value: 'annotation' },
];

function ScopeSection() {
  const { control } = useFormContext<AlertEnrichmentFormData>();

  const scopeOptions = getScopeOptions();

  const scope = useWatch({ control, name: 'scope' });

  const {
    fields: labelMatchersFields,
    append: appendLabelMatcher,
    remove: removeLabelMatcher,
  } = useFieldArray({
    control,
    name: 'labelMatchers',
  });

  const {
    fields: annotationMatchersFields,
    append: appendAnnotationMatcher,
    remove: removeAnnotationMatcher,
  } = useFieldArray({
    control,
    name: 'annotationMatchers',
  });

  return (
    <Field
      label={t('alert-enrichment-form.scope.title', 'Scope')}
      description={t('alert-enrichment-form.scope.description', 'Define which alerts should be enriched')}
      noMargin
    >
      <Stack direction="column" gap={2}>
        <Box>
          <Controller
            name="scope"
            control={control}
            render={({ field: { ref, ...field } }) => <RadioButtonGroup options={scopeOptions} {...field} />}
          />
        </Box>
        {scope === 'label' && (
          <MatcherFields
            fields={labelMatchersFields}
            append={appendLabelMatcher}
            remove={removeLabelMatcher}
            name="labelMatchers"
          />
        )}
        {scope === 'annotation' && (
          <MatcherFields
            fields={annotationMatchersFields}
            append={appendAnnotationMatcher}
            remove={removeAnnotationMatcher}
            name="annotationMatchers"
          />
        )}
      </Stack>
    </Field>
  );
}

interface MatcherFieldsProps {
  fields: Array<FieldArrayWithId<AlertEnrichmentFormData, 'labelMatchers' | 'annotationMatchers'>>;
  append: (value: Matcher) => void;
  remove: (index: number) => void;
  name: 'labelMatchers' | 'annotationMatchers';
}

function MatcherFields({ fields, append, remove, name }: MatcherFieldsProps) {
  const { control, register } = useFormContext<AlertEnrichmentFormData>();
  const matcherTypeOptions = getMatcherTypeOptions();

  return (
    <Stack direction="column" gap={1}>
      {fields.map((field, index) => (
        <Stack key={field.id} direction="row" gap={1}>
          <Field
            label={t('alert-enrichment-form.matcher.name-label', 'Name')}
            noMargin
            htmlFor={`${name}.${index}.name`}
          >
            <Input
              {...register(`${name}.${index}.name`)}
              placeholder={t('alert-enrichment-form.matcher.name-placeholder', 'Name')}
              type="text"
              id={`${name}.${index}.name`}
            />
          </Field>
          <Field
            label={t('alert-enrichment-form.matcher.type-label', 'Type')}
            noMargin
            htmlFor={`${name}.${index}.type`}
          >
            <Controller
              name={`${name}.${index}.type`}
              control={control}
              render={({ field: { ref, ...field } }) => (
                <Combobox
                  {...field}
                  id={`${name}.${index}.type`}
                  options={matcherTypeOptions}
                  placeholder={t('alert-enrichment-form.matcher.type-placeholder', 'Type')}
                />
              )}
            />
          </Field>
          <Field
            label={t('alert-enrichment-form.matcher.value-label', 'Value')}
            noMargin
            htmlFor={`${name}.${index}.value`}
          >
            <Input
              {...register(`${name}.${index}.value`)}
              placeholder={t('alert-enrichment-form.matcher.value-placeholder', 'Value')}
              type="text"
              id={`${name}.${index}.value`}
            />
          </Field>
          <IconButton
            name="trash-alt"
            onClick={() => remove(index)}
            tooltip={t('alert-enrichment-form.matcher.remove-tooltip', 'Remove matcher')}
            aria-label={t('alert-enrichment-form.matcher.remove-aria-label', 'Remove matcher')}
          />
        </Stack>
      ))}
      <div>
        <Button variant="secondary" icon="plus" size="sm" onClick={() => append({ name: '', type: '=', value: '' })}>
          <Trans i18nKey="alert-enrichment-form.matcher.add-button" defaults="Add" />
        </Button>
      </div>
    </Stack>
  );
}
