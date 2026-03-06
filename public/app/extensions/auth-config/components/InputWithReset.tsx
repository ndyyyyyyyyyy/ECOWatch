import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, InlineField, Input, useStyles2 } from '@grafana/ui';

export type Props = React.ComponentProps<typeof Input> & {
  isConfigured: boolean;
  onReset: () => void;
};

export const InputWithReset = ({ isConfigured, onReset, label, ...props }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.inputWithReset}>
      <InlineField label={label} labelWidth={22} htmlFor={props.id}>
        <>{isConfigured ? <Input {...props} value="configured" disabled /> : <Input {...props} />}</>
      </InlineField>

      {isConfigured && (
        <Button className={styles.resetButton} variant="primary" size="md" onClick={onReset}>
          <Trans i18nKey="auth-config.input-with-reset.reset">Reset</Trans>
        </Button>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    resetButton: css({
      borderTopLeftRadius: 'unset',
      borderBottomLeftRadius: 'unset',
    }),
    inputWithReset: css({
      padding: 0,
      display: 'flex',
    }),
  };
};
