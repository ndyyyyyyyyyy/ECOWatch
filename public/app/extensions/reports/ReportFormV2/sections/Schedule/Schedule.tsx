import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Grid, Icon, Stack, useStyles2 } from '@grafana/ui';
import { selectors } from 'app/extensions/reports/e2e-selectors/selectors';
import { schedulePreview } from 'app/extensions/reports/utils/scheduler';
import {
  LAST_DAY_OF_MONTH,
  ReportFormV2,
  ReportSchedulingFrequency,
  ReportSchedulingFrequencyV2,
  SchedulingData,
  SendTime,
} from 'app/extensions/types/reports';

import ReportSection from '../../ReportSection';
import { SectionProps } from '../types';

import { Frequency } from './Frequency';
import { SendLaterSchedule } from './SendLaterSchedule';
import { CustomFrequencyOptions, FrequencyInput, SendTimeOptions } from './components';

function SchedulePreview() {
  const { watch } = useFormContext<ReportFormV2>();
  const styles = useStyles2(getStyles);

  const {
    frequency,
    startTime,
    endTime,
    sendTime,
    lastDayOfMonthOnly,
    timeZone,
    startDate,
    endDate,
    intervalFrequency,
    intervalAmount,
    workdaysOnly,
  } = watch('schedule');

  const scheduleData: SchedulingData = {
    frequency: frequency as unknown as ReportSchedulingFrequency,
    time: { hour: startTime?.hour?.() ?? 0, minute: startTime?.minute?.() ?? 0 },
    endTime: { hour: endTime?.hour?.() ?? 0, minute: endTime?.minute?.() ?? 0 },
    sendTime,
    dayOfMonth: lastDayOfMonthOnly ? LAST_DAY_OF_MONTH : undefined,
    timeZone,
    startDate,
    endDate,
    intervalFrequency,
    intervalAmount: intervalAmount?.toString(),
    workdaysOnly,
  };

  return (
    <div className={styles.preview} data-testid="schedule-preview">
      <Stack alignItems="center">
        <Icon name="calendar-alt" />
        {schedulePreview(scheduleData)}
      </Stack>
    </div>
  );
}

export default function Schedule({ open, onToggle }: SectionProps) {
  const { watch } = useFormContext<ReportFormV2>();

  const { frequency, sendTime } = watch('schedule');

  return (
    <ReportSection
      isOpen={open}
      label={t('share-report.schedule.section-title', 'Schedule')}
      onToggle={onToggle}
      dataTestId={selectors.components.ReportFormDrawer.Schedule.header}
      contentDataTestId={selectors.components.ReportFormDrawer.Schedule.content}
    >
      <Grid columnGap={2} columns={{ xs: 1, md: 3 }}>
        <SendTimeOptions />
        <FrequencyInput />
        {frequency === ReportSchedulingFrequencyV2.Custom ? <CustomFrequencyOptions /> : <div></div>}
        {sendTime === SendTime.Later && <SendLaterSchedule />}
      </Grid>
      <Frequency />
      <SchedulePreview />
    </ReportSection>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    preview: css({
      marginTop: theme.spacing(2),
      color: theme.colors.text.secondary,
    }),
  };
};
