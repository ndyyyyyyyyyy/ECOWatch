import { isAfter, isSameDay } from 'date-fns';

import { t } from '@grafana/i18n';
import { isEmail } from 'app/extensions/utils/validators';

import { ValidationResult } from '../../shared/types';
import { FormRequiredFields, Report, ReportFormV2, StepKey } from '../../types';
import { reportSteps } from '../index';

const arrayFieldIsValid = (field: Report[keyof Report]) => {
  if (Array.isArray(field)) {
    return field?.length;
  }

  return true;
};

export const getValidationResults = (report: Report) => {
  const requiredFields: FormRequiredFields = [
    { step: StepKey.SelectDashboard, fields: ['dashboards'] },
    { step: StepKey.FormatReport, fields: ['formats'] },
    { step: StepKey.Share, fields: ['name', 'recipients'] },
  ];
  const hasMissingDashboard = !report.dashboards?.[0]?.dashboard?.uid;
  return reportSteps.reduce(
    (sum, curr) => {
      sum[curr.id] = { valid: true };
      if (curr.id === StepKey.SelectDashboard) {
        sum[StepKey.SelectDashboard].valid = !hasMissingDashboard;
        return sum;
      } else {
        const fields = requiredFields.find((field) => field.step === curr.id)?.fields;
        if (fields) {
          sum[curr.id].valid = fields.every((field: keyof Report) => report[field] && arrayFieldIsValid(report[field]));
        }
        return sum;
      }
    },
    {} as Record<StepKey, ValidationResult>
  );
};

export const getMissingFields = (report: Report, id?: StepKey) => {
  const results = getValidationResults(report);
  if (id) {
    return !results[id].valid;
  }
  return Object.values(results).some((field) => !field.valid);
};

export const formSchemaValidationRules = (form?: ReportFormV2) => ({
  title: {
    required: t('share-report.report-name.required', 'Report name is required'),
  },
  dashboards: {
    uid: {
      required: t('share-report.dashboard.dashboard-required', 'Dashboard is required'),
    },
  },
  replyTo: {
    validate: (val: string | undefined) => {
      if (!val) {
        return true;
      }
      return isEmail(val) || t('share-report.email-configuration.invalid-email', 'Invalid email');
    },
  },
  schedule: {
    startDate: {
      required: t('share-report.schedule.start-date-required', 'Start date is required'),
    },
    endDate: {
      validate: (val: Date | string | undefined) => {
        if (!val || !form?.schedule?.startDate) {
          return true;
        }

        const isEndDateValid =
          form?.schedule?.startDate &&
          (isSameDay(val, form.schedule.startDate) || isAfter(val, form.schedule.startDate));

        return (
          isEndDateValid ||
          t('share-report.schedule.end-date-invalid', 'End date must be greater or equal to start date')
        );
      },
    },
    intervalAmount: {
      required: t('share-report.schedule.interval-amount-required', 'Interval amount is required'),
      min: {
        value: 2,
        message: t('share-report.schedule.interval-amount-min', 'Interval amount must be at least 2'),
      },
    },
  },
  recipients: {
    required: t('share-report.recipients.recipients-required', 'Recipients are required'),
  },
});
