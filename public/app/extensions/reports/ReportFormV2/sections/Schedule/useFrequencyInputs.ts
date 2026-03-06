import { useFormContext } from 'react-hook-form';

import { dateTime } from '@grafana/data';
import { canBeLastDayOfMonth } from 'app/extensions/reports/utils/dateTime';
import {
  ReportFormV2,
  ReportIntervalFrequency,
  ReportSchedulingFrequencyV2,
  SendTime,
} from 'app/extensions/types/reports';

export const useFrequencyInputs = () => {
  const { watch } = useFormContext<ReportFormV2>();

  const { frequency, lastDayOfMonthOnly, startDate, endDate, intervalFrequency, sendTime } = watch('schedule');

  const canStartDateBeLastDayOfMonth = startDate && canBeLastDayOfMonth(new Date(startDate).getDate());
  const canCurrentDateBeLastDayOfMonth =
    sendTime === SendTime.Now && canBeLastDayOfMonth(dateTime().toDate().getDate());

  const showWorkdaysOnlyCheckbox =
    [ReportSchedulingFrequencyV2.Hourly, ReportSchedulingFrequencyV2.Daily].includes(frequency) ||
    (frequency === ReportSchedulingFrequencyV2.Custom && intervalFrequency === ReportIntervalFrequency.Hours);

  const showEndTimeInput =
    endDate &&
    (frequency === ReportSchedulingFrequencyV2.Hourly ||
      (frequency === ReportSchedulingFrequencyV2.Custom && intervalFrequency === ReportIntervalFrequency.Hours));

  const showLastDayOfMonthWarning =
    frequency === ReportSchedulingFrequencyV2.Monthly &&
    !lastDayOfMonthOnly &&
    (canStartDateBeLastDayOfMonth || canCurrentDateBeLastDayOfMonth);

  return {
    showWorkdaysOnlyCheckbox,
    showEndTimeInput,
    showLastDayOfMonthWarning,
  };
};
