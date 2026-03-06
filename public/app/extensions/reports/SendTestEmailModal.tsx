import { css } from '@emotion/css';
import { ChangeEvent, FC, useState } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Checkbox, Field, Input, Modal, stylesFactory, useTheme } from '@grafana/ui';

import { validateMultipleEmails } from '../utils/validators';

import { selectors } from './e2e-selectors/selectors';

interface Props {
  emails: string;
  onDismiss: () => void;
  onSendTestEmail: (email: string, useEmailsFromReport: boolean) => void;
}

export const SendTestEmailModal: FC<Props> = ({ onDismiss, onSendTestEmail, emails }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const [email, setEmail] = useState('');
  const [emailErrorMessage, setEmailErrorMessage] = useState('');
  const [emailIsInvalid, setEmailIsInvalid] = useState(false);
  const [useEmailsFromReport, setUseEmailsFromReport] = useState(false);

  const handleUseEmailsFromReportChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setUseEmailsFromReport(checked);
    if (checked) {
      setEmail(emails);
      doValidation(emails);
    } else {
      clearError();
      setEmail('');
    }
  };

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.currentTarget.value);
    setEmailIsInvalid(false);
  };

  const doValidation = (e: string): boolean => {
    if (!validateMultipleEmails(e)) {
      setEmailIsInvalid(true);
      setEmailErrorMessage('Invalid email');
      return false;
    } else {
      clearError();
      return true;
    }
  };

  const clearError = () => {
    setEmailIsInvalid(false);
    setEmailErrorMessage('');
  };

  const sendMail = () => {
    doValidation(email);
    if (!doValidation(email)) {
      return;
    }
    onSendTestEmail(email, useEmailsFromReport);
    onDismiss();
  };

  return (
    <Modal
      className={styles.modal}
      isOpen={true}
      title={t('reports.send-test-email-modal.title-send-test-email', 'Send test email')}
      icon="share-alt"
      onDismiss={onDismiss}
    >
      <>
        <div className={styles.content}>
          <Field
            label={t('reports.send-test-email-modal.label-email', 'Email')}
            disabled={useEmailsFromReport}
            invalid={emailIsInvalid}
            error={emailErrorMessage}
          >
            <Input
              disabled={useEmailsFromReport}
              name="email"
              //eslint-disable-next-line @grafana/i18n/no-untranslated-strings
              placeholder="your.address@company.com"
              type="email"
              value={email}
              onChange={handleEmailChange}
            />
          </Field>
          <Checkbox
            value={useEmailsFromReport}
            label={t('reports.send-test-email-modal.label-use-emails-from-report', 'Use emails from report')}
            onChange={handleUseEmailsFromReportChange}
            data-testid={selectors.components.reportForm.useRecipientsCheckbox}
          />
        </div>

        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans i18nKey="reports.send-test-email-modal.cancel">Cancel</Trans>
          </Button>
          <Button
            variant="primary"
            onClick={sendMail}
            data-testid={selectors.components.reportForm.sendTestEmailConfirmButton}
          >
            <Trans i18nKey="reports.send-test-email-modal.send">Send</Trans>
          </Button>
        </Modal.ButtonRow>
      </>
    </Modal>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    modal: css({
      width: '500px',
    }),
    content: css({
      marginBottom: theme.spacing.lg,
    }),
  };
});
