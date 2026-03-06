import { useFormContext, Controller } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Combobox, Field, Input, Stack } from '@grafana/ui';
import { formSchemaValidationRules } from 'app/extensions/reports/utils/validation';
import { ReportFormV2, ReportIntervalFrequency } from 'app/extensions/types/reports';

import { intervalOptions } from '../SendLaterSchedule';

export function CustomFrequencyOptions() {
  const { register, control, formState } = useFormContext<ReportFormV2>();

  const hasError = !!formState.errors.schedule?.intervalAmount;

  return (
    <Field
      label={t('share-report.schedule.repeat-every', 'Repeat every')}
      error={formState.errors.schedule?.intervalAmount?.message}
      {...(hasError && { invalid: true })}
      htmlFor="repeat-frequency"
    >
      <Stack gap={1}>
        <Input
          width={8}
          id="repeat-frequency"
          type="number"
          min={2}
          {...register('schedule.intervalAmount', {
            valueAsNumber: true,
            ...formSchemaValidationRules().schedule.intervalAmount,
          })}
          placeholder={t('share-report.schedule.repeat-every-placeholder', 'e.g. 2')}
          defaultValue={2}
        />
        <Controller
          control={control}
          name="schedule.intervalFrequency"
          defaultValue={ReportIntervalFrequency.Hours}
          render={({ field: { ref, onChange, ...field } }) => (
            <Combobox
              {...field}
              onChange={(interval) => onChange(interval.value)}
              options={intervalOptions}
              placeholder={t('share-report.schedule.repeat-interval-frequency-placeholder', 'e.g. hours')}
            />
          )}
        />
      </Stack>
    </Field>
  );
}
