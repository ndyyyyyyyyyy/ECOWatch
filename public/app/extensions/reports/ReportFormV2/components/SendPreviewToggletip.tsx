import { css } from '@emotion/css';
import { useState } from 'react';
import { useForm, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Field, Input, Stack, Checkbox, Toggletip, useStyles2 } from '@grafana/ui';
import { useSendTestEmailMutation } from 'app/extensions/api/clients/reporting';
import { ReportFormV2 } from 'app/extensions/types/reports';

import { validateMultipleEmails } from '../../../utils/validators';
import { useReportFormContext } from '../../dashboard-scene/ReportRenderingProvider';
import { transformReportV2ToDTO } from '../../utils/serialization';
import { ReportingInteractions } from '../reportingInteractions';
import { SelectDashboardScene } from '../sections/SelectDashboards/SelectDashboardScene';

interface FormValues {
  previewEmail: string;
  useReportEmails: boolean;
}

export function SendPreviewToggletip({ sceneDashboards }: { sceneDashboards: SelectDashboardScene[] }) {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);

  const { watch: watchMainForm, trigger: triggerMainForm } = useFormContext<ReportFormV2>();
  const recipients = watchMainForm('recipients') || [];
  const reportFormContext = useReportFormContext();

  const [sendTestEmail, { isLoading: isSendingTestEmail }] = useSendTestEmailMutation();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      previewEmail: '',
      useReportEmails: false,
    },
  });

  const useReportEmails = watch('useReportEmails');

  const handleClose = () => {
    setIsOpen(false);
    reset({
      previewEmail: '',
      useReportEmails: false,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  const onSubmit = async (data: FormValues) => {
    ReportingInteractions.sendClicked(reportFormContext.renderingContext);

    const report = { ...watchMainForm(), recipients: data.useReportEmails ? recipients : [data.previewEmail] };
    const reportDTO = transformReportV2ToDTO({ ...report, dashboardsScene: sceneDashboards });

    await sendTestEmail(reportDTO).unwrap();
    handleClose();
  };

  const onOpenClick = async () => {
    ReportingInteractions.sendPreviewClicked(reportFormContext.renderingContext);
    const isValid = await triggerMainForm(['title', 'dashboards'], {
      shouldFocus: true,
    });

    if (!isValid) {
      return;
    }

    setIsOpen(true);
  };

  const content = (
    <div className={styles.container}>
      <Stack direction="column" gap={1.5}>
        <Field
          label={t('share-report.send-preview.email', 'Email')}
          required
          description={t(
            'share-report.send-preview.email-description',
            'Separate multiple email addresses with a comma or semicolon'
          )}
          error={errors.previewEmail?.message}
          invalid={!!errors.previewEmail}
        >
          <Input
            // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
            placeholder="your.address@company.com"
            {...register('previewEmail', {
              required: t('share-report.send-preview.email-required', 'Email is required'),
              validate: (value) =>
                validateMultipleEmails(value) ||
                t('share-report.recipients.invalid-emails', 'Invalid emails: {{emails}}', {
                  emails: value,
                }),
            })}
            onKeyDown={handleKeyDown}
            disabled={useReportEmails}
          />
        </Field>
        <Field>
          <Checkbox
            disabled={!recipients.length}
            label={t('share-report.send-preview.use-report-emails', 'Use emails from report')}
            {...register('useReportEmails', {
              onChange: (e) => {
                const checked = e.target.checked;
                setValue('useReportEmails', checked);
                if (checked) {
                  setValue('previewEmail', recipients.join(', '));
                  clearErrors('previewEmail');
                } else {
                  setValue('previewEmail', '');
                }
              },
            })}
          />
        </Field>
        <Stack gap={2} justifyContent="flex-start" direction={{ xs: 'column', sm: 'row' }}>
          <Button variant="secondary" disabled={isSendingTestEmail} onClick={handleClose}>
            {t('share-report.send-preview.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={() => handleSubmit(onSubmit)()}
            disabled={isSendingTestEmail}
            icon={isSendingTestEmail ? 'fa fa-spinner' : undefined}
          >
            {isSendingTestEmail
              ? t('share-report.send-preview.sending', 'Sending...')
              : t('share-report.send-preview.send', 'Send')}
          </Button>
        </Stack>
      </Stack>
    </div>
  );

  return (
    <Toggletip
      content={content}
      title={t('share-report.send-preview.title', 'Send preview')}
      placement="auto-start"
      theme="info"
      show={isOpen}
      onOpen={onOpenClick}
      onClose={handleClose}
    >
      <Button variant="secondary" fill="outline">
        {t('share-report.send-preview.button', 'Send preview')}
      </Button>
    </Toggletip>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      width: '400',
    }),
  };
};
