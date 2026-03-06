import { useFormContext, useFieldArray } from 'react-hook-form';

import { t, Trans } from '@grafana/i18n';
import { InlineFieldRow, InlineField, Input, IconButton, Button, Stack } from '@grafana/ui';

import { AlertEnrichmentFormData } from './form';

interface EnricherConfigProps {
  stepPath: `steps.${number}`;
}

export function AssignEnricherConfig({ stepPath }: EnricherConfigProps) {
  const { control, register } = useFormContext<AlertEnrichmentFormData>();

  const {
    fields: assignAnnotationsFields,
    append: appendAssignAnnotation,
    remove: removeAssignAnnotation,
  } = useFieldArray({
    control,
    name: `${stepPath}.enricher.assign.annotations`,
  });

  return (
    <Stack direction="column" gap={0.5}>
      {assignAnnotationsFields.map((field, index) => {
        const configFieldPath = `${stepPath}.enricher.assign.annotations.${index}` as const;
        const nameFieldId = `${configFieldPath}.name`;
        const valueFieldId = `${configFieldPath}.value`;

        return (
          <InlineFieldRow key={field.id}>
            <InlineField
              label={t('alert-enrichment-form.assign-enricher.annotation-name', 'Key')}
              htmlFor={nameFieldId}
            >
              <Input
                {...register(`${configFieldPath}.name`)}
                placeholder={t('alert-enrichment-form.assign-enricher.annotation-name-placeholder', 'key')}
                id={nameFieldId}
              />
            </InlineField>
            <InlineField
              label={t('alert-enrichment-form.assign-enricher.annotation-value', 'Value')}
              htmlFor={valueFieldId}
            >
              <Input
                {...register(`${configFieldPath}.value`)}
                placeholder={t('alert-enrichment-form.assign-enricher.annotation-value-placeholder', 'value')}
                id={valueFieldId}
              />
            </InlineField>
            <IconButton
              name="trash-alt"
              onClick={() => removeAssignAnnotation(index)}
              tooltip={t('alert-enrichment-form.assign-enricher.remove-annotation-tooltip', 'Remove annotation')}
              aria-label={t('alert-enrichment-form.assign-enricher.remove-annotation-aria-label', 'Remove annotation')}
            />
          </InlineFieldRow>
        );
      })}
      <Button variant="secondary" icon="plus" onClick={() => appendAssignAnnotation({ name: '', value: '' })}>
        <Trans i18nKey="alert-enrichment-form.assign-enricher.add-annotation" defaults="Add annotation assignment" />
      </Button>
    </Stack>
  );
}
