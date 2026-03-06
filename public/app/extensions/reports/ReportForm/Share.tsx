import { css } from '@emotion/css';
import { useForm, Controller } from 'react-hook-form';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { featureEnabled } from '@grafana/runtime';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  FieldSet,
  Input,
  ModalsController,
  TagsInput,
  TextArea,
  useStyles2,
  Stack,
} from '@grafana/ui';
import { contextSrv } from 'app/core/core';

import { AccessControlAction, EnterpriseStoreState, ReportFormData, StepKey } from '../../types';
import { emailSeparator, isEmail, validateMultipleEmails } from '../../utils/validators';
import { SendTestEmailModal } from '../SendTestEmailModal';
import { selectors } from '../e2e-selectors/selectors';
import { sendTestEmail } from '../state/actions';
import { updateReportProp } from '../state/reducers';
import { dashboardsInvalid } from '../utils/dashboards';
import { canEditReport } from '../utils/permissions';

import ReportForm from './ReportForm';

type EmailData = Pick<ReportFormData, 'name' | 'subject' | 'replyTo' | 'recipients' | 'message' | 'enableDashboardUrl'>;

const mapStateToProps = (state: EnterpriseStoreState) => {
  const { testEmailIsSending, report } = state.reports;
  return {
    report,
    testEmailIsSending,
  };
};

const mapActionsToProps = {
  updateReportProp,
  sendTestEmail,
};

const connector = connect(mapStateToProps, mapActionsToProps);
export type Props = ConnectedProps<typeof connector> & { reportId?: string };

export const Share = ({ report, reportId, updateReportProp, sendTestEmail, testEmailIsSending }: Props) => {
  const { message, name, recipients, replyTo, enableDashboardUrl, dashboards, subject } = report;
  const {
    handleSubmit,
    control,
    register,
    setError,
    clearErrors,
    watch,
    getValues,
    formState: { errors, isDirty },
  } = useForm<EmailData>({
    mode: 'onBlur',
  });
  const styles = useStyles2(getStyles);

  const canSendEmail = contextSrv.hasPermission(AccessControlAction.ReportingSend);
  const watchName = watch('name', name);
  const watchRecipients = watch('recipients', recipients);
  const sendEmailDisabled =
    !canSendEmail ||
    !featureEnabled('reports.email') ||
    !watchName ||
    !watchRecipients ||
    dashboardsInvalid(dashboards);

  const onSendTestEmail = (email: string, useEmailsFromReport: boolean) => {
    const reportData = { ...report, ...getValues() };
    const recipients = useEmailsFromReport ? reportData.recipients : email;
    return sendTestEmail({ ...reportData, recipients });
  };

  const saveData = (data: EmailData) => {
    if (isDirty) {
      const { name } = data;
      updateReportProp({ ...report, ...data, name: name.trim() });
    }
  };

  const getFormData = () => {
    const data = getValues();
    const { name } = data;
    return { ...data, name: name.trim() };
  };
  return (
    <ReportForm
      activeStep={StepKey.Share}
      onSubmit={handleSubmit(saveData)}
      confirmRedirect={isDirty}
      getFormData={getFormData}
      reportId={reportId}
      pageActions={[
        <ModalsController key={'send-test-email'}>
          {({ showModal, hideModal }) => (
            <Button
              disabled={sendEmailDisabled}
              size="xs"
              variant="secondary"
              data-testid={selectors.components.reportForm.sendTestEmailButton}
              onClick={(e) => {
                e.preventDefault();
                showModal(SendTestEmailModal, {
                  onDismiss: hideModal,
                  onSendTestEmail,
                  emails: watchRecipients,
                });
              }}
            >
              <Trans i18nKey="reports.share.send-test-email">Send test email</Trans>
            </Button>
          )}
        </ModalsController>,
      ]}
    >
      {testEmailIsSending && (
        <div className={'page-alert-list'}>
          <Alert
            title={t('reports.share.title-sending-test-email', 'Sending test email...')}
            severity={'info'}
            elevated
          />
        </div>
      )}
      <FieldSet label={t('reports.share.label-share', '4. Share')} disabled={!canEditReport}>
        <Field
          label={t('reports.share.label-report-name', 'Report name')}
          required
          invalid={!!errors.name}
          error="Name is required"
        >
          <Input
            {...register('name', { required: true })}
            type="text"
            id="name"
            defaultValue={name}
            placeholder={t('reports.share.name-placeholder-system-status-report', 'System status report')}
            data-testid={selectors.components.reportForm.nameInput}
          />
        </Field>
        <Field
          className={styles.field}
          label={
            <Stack gap={0} alignItems="center" direction="row">
              <span>
                <Trans i18nKey="reports.share.email-subject">Email subject</Trans>
              </span>
              <Button
                icon="info-circle"
                fill="text"
                variant="secondary"
                tooltip={t(
                  'reports.share.email-info-button',
                  'The report name will be used as the email subject if this field is left empty'
                )}
                tooltipPlacement="right"
              />
            </Stack>
          }
        >
          <Input
            {...register('subject')}
            type="text"
            id="subject"
            defaultValue={subject}
            placeholder={t('reports.share.subject-placeholder-email-subject', 'Email subject')}
            data-testid={selectors.components.reportForm.subjectInput}
            autoComplete="off"
          />
        </Field>
        <Field
          className={styles.field}
          label={t('reports.share.label-recipients', 'Recipients')}
          required
          invalid={!!errors.recipients}
          error={errors.recipients?.message}
          description={t(
            'reports.share.description-separate-multiple-emails-comma-semicolon',
            'Separate multiple emails with a comma or semicolon.'
          )}
        >
          <Controller
            name="recipients"
            control={control}
            defaultValue={recipients}
            render={({ field: { ref, value, onChange, ...field } }) => {
              return (
                <TagsInput
                  {...field}
                  id="recipients"
                  disabled={!canEditReport}
                  invalid={!!errors.recipients}
                  onChange={(tags) => {
                    const splitTags = tags
                      .join(';')
                      .split(emailSeparator)
                      .filter(Boolean)
                      .map((tag) => tag.trim());
                    const invalidEmails = splitTags.filter((tag) => !isEmail(tag));
                    if (invalidEmails.length) {
                      setError('recipients', {
                        type: 'manual',
                        message: `Invalid email${invalidEmails.length > 1 ? 's' : ''}: ${invalidEmails.join('; ')}`,
                      });
                    } else {
                      clearErrors('recipients');
                    }
                    onChange(splitTags.filter((tag) => isEmail(tag)).join(';'));
                  }}
                  placeholder={t(
                    'reports.share.recipients-placeholder-recipients-email-addresses-press-enter',
                    'Type in the recipients email addresses and press Enter'
                  )}
                  tags={value ? value.split(emailSeparator) : []}
                  className={styles.tagsInput}
                  addOnBlur
                />
              );
            }}
            rules={{
              validate: (val) => {
                return validateMultipleEmails(val) || 'Invalid email';
              },
            }}
          />
        </Field>
        <Field
          invalid={!!errors.replyTo}
          error={errors.replyTo?.message}
          className={styles.field}
          label={t('reports.share.label-replyto-email-address', 'Reply-to email address')}
          description={t(
            'reports.share.description-address-appear-reply-field-email',
            'The address that will appear in the Reply to field of the email'
          )}
        >
          <Input
            {...register('replyTo', {
              validate: (val) => {
                return validateMultipleEmails(val) || 'Invalid email';
              },
            })}
            id="replyTo"
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="your.address@company.com - optional"
            type="email"
            defaultValue={replyTo}
          />
        </Field>
        <Field className={styles.field} label={t('reports.share.label-message', 'Message')}>
          <TextArea {...register('message')} id="message" placeholder={message} rows={10} defaultValue={message} />
        </Field>
        <Field className={styles.field}>
          <Checkbox
            {...register('enableDashboardUrl')}
            defaultChecked={enableDashboardUrl}
            label={t('reports.share.label-include-a-dashboard-link', 'Include a dashboard link')}
          />
        </Field>
      </FieldSet>
    </ReportForm>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    field: css({
      '&:not(:last-of-type)': {
        marginBottom: theme.spacing(3),
      },
    }),
    tagsInput: css({
      li: {
        marginBottom: theme.spacing(1),
        backgroundColor: `${theme.colors.background.secondary} !important`,
        borderColor: `${theme.components.input.borderColor} !important`,
        color: theme.colors.text.primary,
      },
    }),
  };
};
export default connector(Share);
