import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Combobox, Field } from '@grafana/ui';
import { ReportSchedulingFrequencyV2, ReportFormV2 } from 'app/extensions/types/reports';

const frequencyOptions = [
  { label: 'Once', value: ReportSchedulingFrequencyV2.Once },
  { label: 'Hourly', value: ReportSchedulingFrequencyV2.Hourly },
  { label: 'Daily', value: ReportSchedulingFrequencyV2.Daily },
  { label: 'Weekly', value: ReportSchedulingFrequencyV2.Weekly },
  { label: 'Monthly', value: ReportSchedulingFrequencyV2.Monthly },
  { label: 'Custom', value: ReportSchedulingFrequencyV2.Custom },
];

export function FrequencyInput() {
  const { control } = useFormContext<ReportFormV2>();

  return (
    <Field label={t('share-report.schedule.frequency', 'Frequency')} htmlFor="frequency-combobox">
      <Controller
        name="schedule.frequency"
        control={control}
        render={({ field: { ref, onChange, ...rest } }) => (
          <Combobox
            id="frequency-combobox"
            {...rest}
            options={frequencyOptions}
            onChange={(v) => {
              onChange(v.value);
            }}
          />
        )}
      />
    </Field>
  );
}
