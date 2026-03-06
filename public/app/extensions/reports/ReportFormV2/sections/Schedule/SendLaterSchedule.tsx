import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, TimeZonePicker } from '@grafana/ui';
import { ReportFormV2, ReportIntervalFrequency } from 'app/extensions/types/reports';

import { StartDateInput, StartTimeInput } from './components';

export const intervalOptions = [
  { label: 'hours', value: ReportIntervalFrequency.Hours },
  { label: 'days', value: ReportIntervalFrequency.Days },
  { label: 'weeks', value: ReportIntervalFrequency.Weeks },
  { label: 'months', value: ReportIntervalFrequency.Months },
];

export function SendLaterSchedule() {
  const { control } = useFormContext<ReportFormV2>();

  return (
    <>
      <StartDateInput />
      <StartTimeInput />
      <Field label={t('share-report.schedule.time-zone', 'Time zone')}>
        <Controller
          name="schedule.timeZone"
          render={({ field: { ref, ...field } }) => <TimeZonePicker {...field} openMenuOnFocus={false} />}
          control={control}
        />
      </Field>
    </>
  );
}
