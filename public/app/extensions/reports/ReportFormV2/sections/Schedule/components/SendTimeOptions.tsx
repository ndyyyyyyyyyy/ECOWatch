import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, RadioButtonGroup } from '@grafana/ui';
import { ReportFormV2, SendTime } from 'app/extensions/types/reports';

const sendTimeOptions = [
  { label: 'Send now', value: SendTime.Now },
  { label: 'Send later', value: SendTime.Later },
];

export function SendTimeOptions() {
  const { control } = useFormContext<ReportFormV2>();

  return (
    <Field label={t('share-report.schedule.send-time', 'Schedule')}>
      <Controller
        control={control}
        name="schedule.sendTime"
        render={({ field: { ref, ...rest } }) => <RadioButtonGroup fullWidth {...rest} options={sendTimeOptions} />}
      />
    </Field>
  );
}
