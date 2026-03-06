import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { InlineField, Input, Stack } from '@grafana/ui';

import { AlertEnrichmentFormData } from './form';

interface EnricherConfigProps {
  stepPath: `steps.${number}`;
}

export function ExternalEnricherConfig({ stepPath }: EnricherConfigProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<AlertEnrichmentFormData>();

  const urlFieldId = `${stepPath}.enricher.external.url` as const;

  return (
    <Stack direction="column">
      <InlineField
        label={t('alert-enrichment-form.external-enricher.url-label', 'External Service URL')}
        required
        htmlFor={urlFieldId}
      >
        <Input
          {...register(urlFieldId, {
            required: t(
              'alert-enrichment-form.external-enricher.url-required',
              'URL is required for external enricher'
            ),
          })}
          placeholder={t('alert-enrichment-form.external-enricher.url-placeholder', 'https://api.example.com/enrich')}
          invalid={!!errors.steps?.[0]?.enricher?.external?.url}
          id={urlFieldId}
        />
      </InlineField>
    </Stack>
  );
}
