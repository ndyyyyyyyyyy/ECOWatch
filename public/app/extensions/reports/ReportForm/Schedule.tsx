import { css } from '@emotion/css';
import { isLastDayOfMonth } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { dateTime, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Checkbox,
  DatePickerWithInput,
  Field,
  FieldSet,
  Stack,
  Icon,
  Input,
  RadioButtonGroup,
  Select,
  TimeOfDayPicker,
  TimeZonePicker,
  useStyles2,
} from '@grafana/ui';

import {
  EnterpriseStoreState,
  ReportIntervalFrequency,
  LAST_DAY_OF_MONTH,
  ReportFormData,
  ReportSchedulingFrequency,
  StepKey,
} from '../../types';
import { getTimezone, updateReportProp } from '../state/reducers';
import { getDate, getTime, canBeLastDayOfMonth } from '../utils/dateTime';
import { canEditReport } from '../utils/permissions';
import { isHourFrequency, schedulePreview, showWorkdaysOnly, getOrdinal, getSchedule } from '../utils/scheduler';

import ReportForm from './ReportForm';

const mapStateToProps = (state: EnterpriseStoreState) => {
  const { report } = state.reports;
  return {
    report,
  };
};

const mapActionsToProps = {
  updateReportProp,
};

const connector = connect(mapStateToProps, mapActionsToProps);
export type Props = ConnectedProps<typeof connector> & { reportId?: string };

const frequencyOptions: SelectableValue[] = [
  { label: 'Once', value: ReportSchedulingFrequency.Once },
  { label: 'Hourly', value: ReportSchedulingFrequency.Hourly },
  { label: 'Daily', value: ReportSchedulingFrequency.Daily },
  { label: 'Weekly', value: ReportSchedulingFrequency.Weekly },
  { label: 'Monthly', value: ReportSchedulingFrequency.Monthly },
  { label: 'Custom', value: ReportSchedulingFrequency.Custom },
  { label: 'Never', value: ReportSchedulingFrequency.Never },
];

const intervalOptions: SelectableValue[] = [
  { label: 'hours', value: ReportIntervalFrequency.Hours },
  { label: 'days', value: ReportIntervalFrequency.Days },
  { label: 'weeks', value: ReportIntervalFrequency.Weeks },
  { label: 'months', value: ReportIntervalFrequency.Months },
];

const sendOnTheLastDay = (sendTime: string) => sendTime === 'now' && canBeLastDayOfMonth(dateTime().toDate().getDate());

export const Schedule = ({ report, updateReportProp, reportId }: Props) => {
  const {
    handleSubmit,
    control,
    watch,
    register,
    setValue,
    getValues,
    formState: { isDirty },
  } = useForm();
  const { frequency, timeZone, startDate, endDate, dayOfMonth, intervalAmount, intervalFrequency } = report.schedule;
  const defaultStartDate = frequency === ReportSchedulingFrequency.Never ? '' : startDate;
  const defaultSendTime = defaultStartDate ? 'later' : 'now';
  const defaultSchedule = {
    startDate: defaultStartDate,
    sendTime: defaultSendTime,
    intervalFrequency: ReportIntervalFrequency.Hours,
    intervalAmount: '2',
    sendOnLastDayOfMonth: dayOfMonth === LAST_DAY_OF_MONTH,
    ...report.schedule,
  };
  const watchSchedule = watch('schedule', defaultSchedule) || {};
  const {
    frequency: watchFrequency,
    startDate: watchStartDate,
    endDate: watchEndDate,
    intervalFrequency: watchIntervalFrequency = ReportIntervalFrequency.Hours,
    dayOfMonth: watchDayOfMonth,
    sendOnLastDayOfMonth: watchSendOnLastDayOfMonth,
    sendTime: watchSendTime = defaultSendTime,
    workdaysOnly: watchWorkdaysOnly,
  } = watchSchedule;
  const styles = useStyles2(getStyles);

  const date = new Date(watchStartDate);

  const saveData = (data: Partial<ReportFormData>) => {
    if (isDirty) {
      const schedule = getSchedule(data.schedule);
      updateReportProp({ ...report, schedule });
    }
  };

  const getFormData = () => {
    return { schedule: getSchedule(getValues().schedule) };
  };

  const onStartDateChange = (date: Date) => {
    const sendOnLastDayOfMonth = watchSendOnLastDayOfMonth && isLastDayOfMonth(date);
    setValue('schedule.sendOnLastDayOfMonth', sendOnLastDayOfMonth);
    setValue('schedule.dayOfMonth', sendOnLastDayOfMonth ? LAST_DAY_OF_MONTH : '');
  };

  const onSendOnLastDayOfMonthChange = (isChecked: boolean) => {
    const endOfMonthDate = dateTime(watchStartDate).endOf('month').toDate();
    setValue('schedule.startDate', endOfMonthDate);
    setValue('schedule.dayOfMonth', isChecked ? LAST_DAY_OF_MONTH : '');
  };

  const warningDateText = getOrdinal(sendOnTheLastDay(watchSendTime) ? dateTime().toDate().getDate() : date.getDate());

  return (
    <ReportForm
      activeStep={StepKey.Schedule}
      onSubmit={handleSubmit(saveData)}
      confirmRedirect={isDirty}
      getFormData={getFormData}
      reportId={reportId}
    >
      <FieldSet label={t('reports.schedule.label-schedule', '3. Schedule')}>
        <Field label={t('reports.schedule.label-frequency', 'Frequency')}>
          <Controller
            defaultValue={frequency}
            name="schedule.frequency"
            render={({ field: { ref, onChange, ...field } }) => (
              <RadioButtonGroup
                {...field}
                fullWidth
                options={frequencyOptions}
                disabled={!canEditReport}
                onChange={(val) => {
                  if (!showWorkdaysOnly(val, watchIntervalFrequency)) {
                    setValue('schedule.workdaysOnly', false);
                  }
                  onChange(val);
                }}
              />
            )}
            control={control}
          />
        </Field>

        {watchFrequency !== ReportSchedulingFrequency.Never && (
          <Field label={t('reports.schedule.label-time', 'Time')}>
            <Controller
              control={control}
              name={'schedule.sendTime'}
              defaultValue={defaultSendTime}
              render={({ field: { ref, onChange, ...field } }) => (
                <RadioButtonGroup
                  {...field}
                  onChange={(value) => {
                    if (value !== 'now' && !watchStartDate) {
                      setValue('schedule.startDate', dateTime().toDate());
                    } else if (value === 'now') {
                      setValue('schedule.startDate', '');
                    }
                    onChange(value);
                  }}
                  options={[
                    { label: t('reporting.schedule.frecuency-send-now', 'Send now'), value: 'now' },
                    { label: t('reporting.schedule.frecuency-send-later', 'Send later'), value: 'later' },
                  ]}
                />
              )}
            />
          </Field>
        )}

        <>
          {watchFrequency === ReportSchedulingFrequency.Custom && (
            <Stack>
              <Field label={t('reporting.schedule.frecuency-custom-input-label', 'Repeat every')}>
                <Input
                  type={'number'}
                  min={'2'}
                  {...register('schedule.intervalAmount')}
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  placeholder="2"
                  defaultValue={intervalAmount || 2}
                  id={'repeat-frequency'}
                />
              </Field>
              <Field label={' '}>
                <Controller
                  control={control}
                  defaultValue={
                    intervalOptions.find((opt) => opt.value === intervalFrequency)?.value ||
                    ReportIntervalFrequency.Hours
                  }
                  render={({ field: { ref, onChange, ...field } }) => (
                    <Select
                      {...field}
                      onChange={(interval) => onChange(interval.value)}
                      options={intervalOptions}
                      width={16}
                      placeholder={t('reporting.schedule.frecuency-custom-select-placeholder', 'hours')}
                      aria-label={t('reporting.schedule.frecuency-custom-select-label', 'Custom frequency')}
                    />
                  )}
                  name={'schedule.intervalFrequency'}
                />
              </Field>
            </Stack>
          )}

          {watchFrequency === ReportSchedulingFrequency.Monthly &&
            (sendOnTheLastDay(watchSendTime) || watchSendTime === 'later') && (
              <Field>
                <Controller
                  control={control}
                  defaultValue={watchDayOfMonth === LAST_DAY_OF_MONTH}
                  render={({ field: { onChange, ...field } }) => (
                    <Checkbox
                      {...field}
                      label={t('reporting.schedule.frecuency-last-day-label', 'Send on the last day of month')}
                      onChange={(e) => {
                        onSendOnLastDayOfMonthChange(e.currentTarget.checked);
                        onChange(e.currentTarget.checked);
                      }}
                    />
                  )}
                  name={'schedule.sendOnLastDayOfMonth'}
                />
              </Field>
            )}
        </>

        {/*Hide date/time fields instead of completely removing them, so the timezone value doesn't get reset */}
        <div
          className={watchSendTime !== 'now' && watchFrequency !== ReportSchedulingFrequency.Never ? '' : styles.hidden}
        >
          <Stack>
            <Field label={t('reports.schedule.label-start-date', 'Start date')}>
              <Controller
                name={'schedule.startDate'}
                control={control}
                defaultValue={getDate(defaultStartDate)}
                render={({ field: { ref, onChange, ...field } }) => (
                  <DatePickerWithInput
                    {...field}
                    width={16}
                    placeholder={t('reporting.schedule.frecuency-date-picker-placeholder', 'Select date')}
                    aria-label={t('reporting.schedule.frecuency-date-picker-label', 'Report schedule start date')}
                    closeOnSelect
                    onChange={(v) => {
                      const date = new Date(v);
                      onStartDateChange(date);
                      onChange(date);
                    }}
                  />
                )}
              />
            </Field>

            <Field label={t('reporting.schedule.frecuency-start-time-label', 'Start time')}>
              <Controller
                name="schedule.time"
                render={({ field: { onChange, ref, value, ...field } }) => (
                  <TimeOfDayPicker
                    {...field}
                    value={value as any}
                    minuteStep={10}
                    disabled={!canEditReport}
                    onChange={(selected) => {
                      if (selected.isValid()) {
                        onChange({
                          hour: selected.hour?.(),
                          minute: selected.minute?.(),
                        });
                      }
                    }}
                  />
                )}
                defaultValue={getTime(startDate)}
                control={control}
              />
            </Field>
            <>
              <Field label={t('reporting.schedule.frecuency-time-zone-label', 'Time zone')}>
                <Controller
                  name="schedule.timeZone"
                  render={({ field: { ref, ...field } }) => (
                    <TimeZonePicker {...field} width={30} disabled={!canEditReport} />
                  )}
                  defaultValue={timeZone || getTimezone()}
                  control={control}
                />
              </Field>
            </>
          </Stack>
        </div>
        {watchFrequency === ReportSchedulingFrequency.Monthly &&
          !watchSendOnLastDayOfMonth &&
          (canBeLastDayOfMonth(date.getDate()) || sendOnTheLastDay(watchSendTime)) && (
            <small className={styles.warningText}>
              <Trans i18nKey={'reporting.schedule.frecuency-last-day-warning'}>
                Note: some months do not have a {{ warningDateText }} day and reports will not be sent on those months.
                Choose an earlier date or <strong>&quot;Send on the last day of month&quot;</strong> to send a report at
                the end of each month.
              </Trans>
            </small>
          )}
        {![ReportSchedulingFrequency.Once, ReportSchedulingFrequency.Never].includes(watchFrequency) && (
          <Stack>
            <Field label={t('reporting.schedule.frecuency-end-date-label', 'End date')}>
              <Controller
                name={'schedule.endDate'}
                control={control}
                defaultValue={getDate(endDate)}
                render={({ field: { ref, ...field } }) => (
                  <DatePickerWithInput
                    {...field}
                    width={16}
                    placeholder={t('reporting.schedule.report-schedule-end-date-placeholder', 'Does not end')}
                    aria-label={t('reporting.schedule.report-schedule-end-date-label', 'Report schedule end date')}
                    minDate={new Date(watchStartDate)}
                    closeOnSelect
                  />
                )}
              />
            </Field>

            {watchEndDate &&
              (watchFrequency === ReportSchedulingFrequency.Hourly ||
                isHourFrequency(watchFrequency, watchIntervalFrequency)) && (
                <Field label={t('reporting.schedule.frecuency-end-time-label', 'End time')}>
                  <Controller
                    name="schedule.endTime"
                    render={({ field: { onChange, ref, value, ...field } }) => (
                      <TimeOfDayPicker
                        {...field}
                        // The component is missing MomentInput type, even though moment.js is used for conversion
                        value={value as any}
                        minuteStep={10}
                        disabled={!canEditReport}
                        onChange={(selected) => {
                          if (selected?.isValid()) {
                            onChange({
                              hour: selected.hour?.(),
                              minute: selected.minute?.(),
                            });
                          }
                        }}
                      />
                    )}
                    defaultValue={getTime(endDate)}
                    control={control}
                  />
                </Field>
              )}
          </Stack>
        )}

        {showWorkdaysOnly(watchFrequency, watchIntervalFrequency) && (
          <Field>
            <Checkbox
              {...register('schedule.workdaysOnly')}
              label={t('reporting.schedule.frecuency-workdays-label', 'Send Monday to Friday only')}
              defaultChecked={watchWorkdaysOnly}
            />
          </Field>
        )}
        <Stack alignItems={'center'}>
          <Icon name={'calendar-alt'} />
          {schedulePreview({ ...defaultSchedule, ...watchSchedule })}
        </Stack>
      </FieldSet>
    </ReportForm>
  );
};

export default connector(Schedule);

const getStyles = (theme: GrafanaTheme2) => {
  return {
    warningText: css({
      color: theme.colors.warning.main,
      display: 'block',
      margin: theme.spacing(-1, 0, 3, 0),
    }),
    hidden: css({
      display: 'none',
    }),
  };
};
