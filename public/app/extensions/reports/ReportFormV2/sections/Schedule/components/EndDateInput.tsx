import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field } from '@grafana/ui';
import { formSchemaValidationRules } from 'app/extensions/reports/utils/validation';
import { ReportFormV2 } from 'app/extensions/types/reports';

import { DatePickerInput } from './DatePickerInput';

export function EndDateInput() {
  const {
    control,
    watch,
    formState: { errors },
    resetField,
  } = useFormContext<ReportFormV2>();

  const startDate = watch('schedule.startDate') ?? new Date();

  return (
    <Field
      label={t('share-report.schedule.end-date', 'End date')}
      error={errors.schedule?.endDate?.message}
      invalid={!!errors.schedule?.endDate?.message}
      htmlFor="end-date-picker"
    >
      <Controller
        name="schedule.endDate"
        control={control}
        rules={formSchemaValidationRules(watch()).schedule.endDate}
        render={({ field: { value, ...field } }) => (
          <DatePickerInput
            id="end-date-picker"
            {...field}
            value={value || ''}
            placeholder={t('share-report.schedule.end-date-placeholder', 'Does not end')}
            minDate={new Date(startDate)}
            onClear={() => resetField('schedule.endDate')}
          />
        )}
      />
    </Field>
  );
}
