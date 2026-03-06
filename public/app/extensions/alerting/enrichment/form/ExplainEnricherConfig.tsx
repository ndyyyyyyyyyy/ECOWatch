import { useFormContext } from 'react-hook-form';

import { t, Trans } from '@grafana/i18n';
import { InlineField, Input, Stack, Text } from '@grafana/ui';

import { AlertEnrichmentFormData } from './form';

interface EnricherConfigProps {
  stepPath: `steps.${number}`;
}

export function ExplainEnricherConfig({ stepPath }: EnricherConfigProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<AlertEnrichmentFormData>();

  return (
    <Stack direction="column" gap={2}>
      <Text variant="body" color="info">
        <Trans
          i18nKey="alert-enrichment-form.explain-enricher.description"
          defaults="Explain enricher uses LLM to generate explanations for alerts. Configure the annotation key where the explanation will be stored."
        />
      </Text>

      <InlineField
        label={t('alert-enrichment-form.explain-enricher.annotation-label', 'Annotation Key')}
        required
        tooltip={t(
          'alert-enrichment-form.explain-enricher.annotation-tooltip',
          'The annotation key where the LLM-generated explanation will be stored'
        )}
      >
        <Input
          {...register(`${stepPath}.enricher.explain.annotation`, {
            required: t(
              'alert-enrichment-form.explain-enricher.annotation-required',
              'Annotation key is required for explain enricher'
            ),
          })}
          placeholder={t('alert-enrichment-form.explain-enricher.annotation-placeholder', 'explanation')}
          invalid={!!errors.steps?.[0]?.enricher?.explain?.annotation}
        />
      </InlineField>
    </Stack>
  );
}
