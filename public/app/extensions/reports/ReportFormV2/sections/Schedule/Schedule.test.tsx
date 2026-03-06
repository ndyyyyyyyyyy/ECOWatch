import { screen } from '@testing-library/react';
import { endOfMonth } from 'date-fns';
import { FormProvider, useForm } from 'react-hook-form';
import { render } from 'test/test-utils';

import { dateTime } from '@grafana/data';
import { getTimezone } from 'app/extensions/reports/state/reducers';
import {
  ReportSchedulingFrequencyV2,
  ReportIntervalFrequency,
  SendTime,
  ReportFormV2,
} from 'app/extensions/types/reports';

import Schedule from './Schedule';

const ScheduleWrapper = ({ defaultValues = {} }) => {
  const methods = useForm<ReportFormV2>({
    defaultValues: {
      schedule: {
        ...defaultValues,
      },
    },
  });

  return (
    <FormProvider {...methods}>
      <Schedule open={true} onToggle={() => {}} />
    </FormProvider>
  );
};

function setup(defaultValues: Partial<ReportFormV2['schedule']>) {
  return render(<ScheduleWrapper defaultValues={defaultValues} />);
}

const assertSendNowRender = () => {
  expect(screen.queryByRole('textbox', { name: /start date/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/start time/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/time zone/i)).not.toBeInTheDocument();
};

const assertSendLaterRender = () => {
  expect(screen.getByRole('textbox', { name: /start date/i })).toBeInTheDocument();
  expect(screen.getByText(/start time/i)).toBeInTheDocument();
  expect(screen.getByText(/time zone/i)).toBeInTheDocument();
};

const assertHourlyOrDailyRender = (assertEndTime = false) => {
  expect(screen.getByText(/end date/i)).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /send monday to friday only/i })).toBeInTheDocument();

  if (assertEndTime) {
    expect(screen.getByText(/end time/i)).toBeInTheDocument();
  } else {
    expect(screen.queryByText(/end time/i)).not.toBeInTheDocument();
  }
};

describe('Schedule', () => {
  it('should render Schedule components correctly', () => {
    setup({
      sendTime: SendTime.Later,
      frequency: ReportSchedulingFrequencyV2.Once,
      startDate: new Date(),
      startTime: dateTime(),
    });

    expect(screen.getByRole('radio', { name: 'Send now' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Send later' })).toBeChecked();

    const frequencyCombobox = screen.getByRole('combobox', { name: /frequency/i });
    expect(frequencyCombobox).toBeInTheDocument();
    expect(frequencyCombobox).toHaveValue('Once');

    expect(screen.getByText(/This report will be sent: Once/i)).toBeInTheDocument();
  });

  describe('Correct fields for each time-schedule-option are displayed correctly', () => {
    it('send now with custom frequency', async () => {
      setup({
        sendTime: SendTime.Now,
        frequency: ReportSchedulingFrequencyV2.Custom,
        intervalAmount: 2,
        intervalFrequency: ReportIntervalFrequency.Hours,
      });

      assertSendNowRender();

      expect(screen.getByRole('spinbutton', { name: /repeat every/i })).toBeInTheDocument();
      expect(screen.getAllByRole('combobox')[1]).toHaveValue('hours');
      expect(
        screen.getByText(/This report will be sent immediately after it's saved and then every 2 hours./i)
      ).toBeInTheDocument();
    });

    it('send later', async () => {
      setup({
        sendTime: SendTime.Later,
        frequency: ReportSchedulingFrequencyV2.Once,
        startDate: new Date(),
        startTime: dateTime(),
      });
      assertSendLaterRender();
      expect(screen.getByText(/This report will be sent: Once/i)).toBeInTheDocument();
    });

    it('send later with custom frequency', async () => {
      setup({
        sendTime: SendTime.Later,
        frequency: ReportSchedulingFrequencyV2.Custom,
        intervalAmount: 2,
        intervalFrequency: ReportIntervalFrequency.Hours,
        startTime: dateTime(),
        startDate: new Date(),
      });

      assertSendLaterRender();

      expect(screen.getByRole('spinbutton', { name: /repeat every/i })).toBeInTheDocument();
      expect(screen.getAllByRole('combobox')[1]).toHaveValue('hours');
      expect(screen.getByText(/This report will be sent: Every 2 hours/i)).toBeInTheDocument();
    });
  });

  describe('Correct fields for each frequency-option are displayed correctly', () => {
    describe('hourly', () => {
      it('send now', async () => {
        setup({
          frequency: ReportSchedulingFrequencyV2.Hourly,
          sendTime: SendTime.Now,
        });

        assertSendNowRender();
        assertHourlyOrDailyRender(false);

        expect(
          screen.getByText(/This report will be sent immediately after it's saved and then every hour./i)
        ).toBeInTheDocument();
      });

      it('send later', async () => {
        setup({
          frequency: ReportSchedulingFrequencyV2.Hourly,
          endDate: undefined,
          startDate: new Date(),
          startTime: dateTime(),
          sendTime: SendTime.Later,
          timeZone: getTimezone(),
        });

        assertSendLaterRender();
        assertHourlyOrDailyRender(false);

        expect(screen.getByText(/This report will be sent: Hourly at minute/i)).toBeInTheDocument();
      });
    });

    describe('daily', () => {
      it('send now', async () => {
        setup({
          frequency: ReportSchedulingFrequencyV2.Daily,
          sendTime: SendTime.Now,
        });

        assertSendNowRender();
        assertHourlyOrDailyRender(false);

        expect(
          screen.getByText(/This report will be sent immediately after it's saved and then every day./i)
        ).toBeInTheDocument();
      });

      it('send later', async () => {
        setup({
          frequency: ReportSchedulingFrequencyV2.Daily,
          sendTime: SendTime.Later,
          startDate: new Date(),
          startTime: dateTime(),
        });

        assertSendLaterRender();
        assertHourlyOrDailyRender(false);

        expect(screen.getByText(/This report will be sent: Daily at/i)).toBeInTheDocument();
      });
    });

    describe('weekly', () => {
      it('send now', async () => {
        setup({
          frequency: ReportSchedulingFrequencyV2.Weekly,
          sendTime: SendTime.Now,
        });

        assertSendNowRender();
        expect(screen.getByText(/end date/i)).toBeInTheDocument();
        expect(screen.queryByText(/end time/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /send monday to friday only/i })).not.toBeInTheDocument();

        expect(
          screen.getByText(/This report will be sent immediately after it's saved and then every week./i)
        ).toBeInTheDocument();
      });

      it('send later', async () => {
        setup({
          frequency: ReportSchedulingFrequencyV2.Weekly,
          sendTime: SendTime.Later,
          startDate: new Date(),
          startTime: dateTime(),
        });

        assertSendLaterRender();

        expect(screen.getByText(/end date/i)).toBeInTheDocument();
        expect(screen.getByText(/This report will be sent: Every/i)).toBeInTheDocument();
      });
    });

    describe('monthly', () => {
      it('send now', async () => {
        setup({
          frequency: ReportSchedulingFrequencyV2.Monthly,
          sendTime: SendTime.Now,
        });

        assertSendNowRender();

        expect(screen.getByText(/end date/i)).toBeInTheDocument();
        expect(
          screen.getByText(/This report will be sent immediately after it's saved and then every month./i)
        ).toBeInTheDocument();
      });

      it('send later', async () => {
        setup({
          frequency: ReportSchedulingFrequencyV2.Monthly,
          sendTime: SendTime.Later,
          startDate: new Date(),
        });

        assertSendLaterRender();

        expect(screen.getByText(/end date/i)).toBeInTheDocument();
        expect(screen.getByText(/This report will be sent: Monthly on the/i)).toBeInTheDocument();
      });

      it('should show end-of-month warning when the start date is the last day of the month', async () => {
        setup({
          sendTime: SendTime.Later,
          frequency: ReportSchedulingFrequencyV2.Monthly,
          startDate: endOfMonth(new Date()),
        });

        expect(screen.queryByText(/Note: Reports won't be sent on months that don't have a/i)).toBeInTheDocument();
      });

      it('should not show end-of-month warning when the start date is the last day of the month, but send-on-the-last-day-of-month is checked', async () => {
        setup({
          frequency: ReportSchedulingFrequencyV2.Monthly,
          startDate: endOfMonth(new Date()),
          lastDayOfMonthOnly: true,
        });

        expect(screen.queryByText(/Note: Reports won't be sent on months that don't have a/i)).not.toBeInTheDocument();
      });
    });

    describe('custom', () => {
      it('send now', async () => {
        setup({
          sendTime: SendTime.Now,
          frequency: ReportSchedulingFrequencyV2.Custom,
          endDate: new Date(),
          endTime: dateTime(),
          intervalAmount: 2,
          intervalFrequency: ReportIntervalFrequency.Hours,
        });

        assertSendNowRender();
        assertCustomRender(ReportIntervalFrequency.Hours);

        expect(
          screen.getByText(/This report will be sent immediately after it's saved and then every 2 hours./i)
        ).toBeInTheDocument();
      });

      it('send later', async () => {
        setup({
          sendTime: SendTime.Later,
          frequency: ReportSchedulingFrequencyV2.Custom,
          startDate: new Date(),
          startTime: dateTime(),
          intervalAmount: 2,
          endDate: new Date(),
          endTime: dateTime(),
          intervalFrequency: ReportIntervalFrequency.Hours,
        });

        assertSendLaterRender();
        assertCustomRender(ReportIntervalFrequency.Hours);

        expect(screen.getByText(/This report will be sent: Every 2 hours/i)).toBeInTheDocument();
      });

      it('days interval frequency should not show neither end-time input nor send-monday-to-friday-only checkbox', async () => {
        setup({
          sendTime: SendTime.Later,
          frequency: ReportSchedulingFrequencyV2.Custom,
          startDate: new Date(),
          startTime: dateTime(),
          intervalAmount: 2,
          endDate: new Date(),
          endTime: dateTime(),
          intervalFrequency: ReportIntervalFrequency.Days,
        });

        assertCustomRender(ReportIntervalFrequency.Days);
      });

      it('weeks interval frequency should not show neither end-time input nor send-monday-to-friday-only checkbox', async () => {
        setup({
          sendTime: SendTime.Later,
          frequency: ReportSchedulingFrequencyV2.Custom,
          startDate: new Date(),
          startTime: dateTime(),
          intervalAmount: 2,
          endDate: new Date(),
          endTime: dateTime(),
          intervalFrequency: ReportIntervalFrequency.Weeks,
        });

        assertCustomRender(ReportIntervalFrequency.Weeks);
      });

      it('months interval frequency should not show neither end-time input nor send-monday-to-friday-only checkbox', async () => {
        setup({
          sendTime: SendTime.Later,
          frequency: ReportSchedulingFrequencyV2.Custom,
          startDate: new Date(),
          startTime: dateTime(),
          intervalAmount: 2,
          endDate: new Date(),
          endTime: dateTime(),
          intervalFrequency: ReportIntervalFrequency.Months,
        });

        assertCustomRender(ReportIntervalFrequency.Months);
      });
    });
  });
});

const assertCustomRender = (intervalFrequency: ReportIntervalFrequency) => {
  expect(screen.getByRole('spinbutton', { name: /repeat every/i })).toBeInTheDocument();
  expect(screen.getAllByRole('combobox')[1]).toHaveValue(intervalFrequency);
  expect(screen.getByText(/end date/i)).toBeInTheDocument();

  if (intervalFrequency === ReportIntervalFrequency.Hours) {
    expect(screen.queryByText(/end time/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /send monday to friday only/i })).toBeInTheDocument();
  } else {
    expect(screen.queryByText(/end time/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /send monday to friday only/i })).not.toBeInTheDocument();
  }
};
