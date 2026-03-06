import { css } from '@emotion/css';
import { forwardRef, useImperativeHandle, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { SAMLStepKey } from '../../types';

import { getNextStep, getPreviousStep, goToPreviousStep } from './utils/stepper';

interface ButtonRowProps {
  activeStep: SAMLStepKey;
  disabled?: boolean;
}

export type ButtonHandle = {
  click: () => void;
};

export const ButtonRow = forwardRef<ButtonHandle, ButtonRowProps>(({ activeStep, disabled }, ref) => {
  const styles = useStyles2(getStyles);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const previousStep = getPreviousStep(activeStep);
  const nextStep = getNextStep(activeStep);
  const isLastStep = nextStep.id === activeStep;

  // Enable clicking Submit from a parent component
  useImperativeHandle(ref, () => ({
    click: () => {
      buttonRef.current?.click();
    },
  }));

  const onClickPrevious = () => {
    // Submit form to save data by clicking submit button
    buttonRef.current?.click();
    goToPreviousStep(activeStep);
  };

  return (
    <div className={styles.buttonRow}>
      <div className={styles.buttonRowInner}>
        <div>
          {previousStep && (
            <Button variant={'secondary'} onClick={onClickPrevious}>
              {t('auth-config.SAML.button-row-previous', 'Previous: {{name}}', {
                name: previousStep.name,
              })}
            </Button>
          )}
          {!isLastStep && (
            <Button ref={buttonRef} disabled={disabled} type="submit">
              {t('auth-config.SAML.button-row-next', 'Next: {{name}}', {
                name: nextStep.name,
              })}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

ButtonRow.displayName = 'ButtonRow';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    buttonRow: css({
      display: 'flex',
      padding: theme.spacing(2, 0, 0.5, 0),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      width: '100%',
      backgroundColor: theme.colors.background.primary,
      button: {
        '&:first-of-type': {
          marginRight: theme.spacing(2),
        },
        '&:last-of-type': {
          marginRight: 0,
        },
      },
    }),
    buttonRowInner: css({
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%',
    }),
  };
};
