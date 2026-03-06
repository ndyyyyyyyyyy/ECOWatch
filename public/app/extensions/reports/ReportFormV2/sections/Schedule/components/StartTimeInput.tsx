import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, TimeOfDayPicker } from '@grafana/ui';
import { ReportFormV2 } from 'app/extensions/types';

export function StartTimeInput() {
  const { control } = useFormContext<ReportFormV2>();

  return (
    <Field label={t('share-report.schedule.start-time', 'Start time')}>
      <Controller
        name="schedule.startTime"
        render={({ field: { ref, ...field } }) => {
          return <TimeOfDayPicker {...field} minuteStep={10} />;
        }}
        control={control}
      />
    </Field>
  );
}
