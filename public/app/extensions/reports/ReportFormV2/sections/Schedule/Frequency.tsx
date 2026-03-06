import { format } from 'date-fns';
import { useFormContext } from 'react-hook-form';

import { dateTime } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Checkbox, Grid } from '@grafana/ui';
import { ReportFormV2, ReportSchedulingFrequencyV2, SendTime } from 'app/extensions/types/reports';

import { EndDateInput, EndTimeInput, WorkdaysOnlyCheckbox } from './components';
import { useFrequencyInputs } from './useFrequencyInputs';

export function Frequency() {
  const { watch, setValue, register } = useFormContext<ReportFormV2>();

  const { frequency, sendTime, startDate } = watch('schedule');
  const { showWorkdaysOnlyCheckbox, showEndTimeInput, showLastDayOfMonthWarning } = useFrequencyInputs();

  const onSendOnLastDayOfMonthChange = () => {
    const endOfMonthDate = dateTime(startDate).endOf('month').toDate();
    setValue('schedule.startDate', endOfMonthDate);
  };

  const lastDayOfMonthOnlyRegister = register('schedule.lastDayOfMonthOnly');

  return (
    <>
      {showLastDayOfMonthWarning && (
        <Alert severity="warning" title="">
          {t(
            'share-report.schedule.monthly-schedule-alert-title',
            'Note: Reports won\'t be sent on months that don\'t have a {{ dayNumber }} day. Choose an earlier date or select "Send on the last day of the month" to send a report at the end of every month.',
            {
              dayNumber: format(sendTime === 'now' ? dateTime().toDate() : startDate!, 'do'),
            }
          )}
        </Alert>
      )}
      {frequency !== ReportSchedulingFrequencyV2.Once && (
        <Grid columnGap={2} columns={{ xs: 1, md: 3 }}>
          <EndDateInput />
          {showEndTimeInput && <EndTimeInput />}
        </Grid>
      )}
      {showWorkdaysOnlyCheckbox && <WorkdaysOnlyCheckbox />}
      {sendTime === SendTime.Later && frequency === ReportSchedulingFrequencyV2.Monthly && (
        <Checkbox
          {...lastDayOfMonthOnlyRegister}
          label={t('share-report.schedule.last-day-of-month', 'Send on the last day of month')}
          onChange={(e) => {
            onSendOnLastDayOfMonthChange();
            lastDayOfMonthOnlyRegister.onChange(e);
          }}
        />
      )}
    </>
  );
}
