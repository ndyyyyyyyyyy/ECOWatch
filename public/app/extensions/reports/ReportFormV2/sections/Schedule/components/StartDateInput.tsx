import { isLastDayOfMonth } from 'date-fns';
import { useFormContext, Controller } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field } from '@grafana/ui';
import { formSchemaValidationRules } from 'app/extensions/reports/utils/validation';
import { ReportFormV2 } from 'app/extensions/types';

import { DatePickerInput } from './DatePickerInput';

export function StartDateInput() {
  const {
    watch,
    setValue,
    trigger,
    control,
    formState: { errors, isSubmitted },
  } = useFormContext<ReportFormV2>();

  const onStartDateChange = (date: Date) => {
    const lastDayOfMonth = watch('schedule.lastDayOfMonthOnly');
    const sendOnLastDayOfMonth = lastDayOfMonth && isLastDayOfMonth(date);
    setValue('schedule.lastDayOfMonthOnly', sendOnLastDayOfMonth);
  };

  return (
    <Field
      label={t('share-report.schedule.start-date', 'Start date')}
      error={errors.schedule?.startDate?.message}
      invalid={!!errors.schedule?.startDate?.message}
      htmlFor="start-date-picker"
    >
      <Controller
        name="schedule.startDate"
        control={control}
        rules={formSchemaValidationRules().schedule.startDate}
        defaultValue={new Date()}
        render={({ field: { onChange, ...field } }) => (
          <DatePickerInput
            id="start-date-picker"
            {...field}
            placeholder={t('share-report.schedule.start-date-placeholder', 'Select date')}
            onChange={(v) => {
              const date = new Date(v);
              onStartDateChange(date);
              onChange(date);
              if (isSubmitted) {
                trigger('schedule.endDate');
              }
            }}
            minDate={new Date()}
          />
        )}
      />
    </Field>
  );
}
