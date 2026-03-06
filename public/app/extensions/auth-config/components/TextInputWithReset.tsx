import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, FileUpload, TextArea, useStyles2 } from '@grafana/ui';

export type Props = React.ComponentProps<typeof TextArea> & {
  isConfigured: boolean;
  onReset: () => void;
  onFileUpload: (event: React.FormEvent<HTMLInputElement>) => void;
};

export const TextInputWithReset = ({ isConfigured, onReset, onFileUpload, ...props }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.inputWithReset}>
      <div className={styles.textAreaInput}>
        {isConfigured && <TextArea {...props} value="configured" disabled />}
        {!isConfigured && <TextArea {...props} />}
      </div>
      {isConfigured && (
        <Button className={styles.fileUploadButton} variant="primary" size="md" onClick={onReset}>
          <Trans i18nKey="auth-config.text-input-with-reset.reset">Reset</Trans>
        </Button>
      )}
      {!isConfigured && (
        <FileUpload className={styles.fileUploadButton} showFileName={false} onFileUpload={onFileUpload} />
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
    fileUploadButton: css({
      marginLeft: theme.spacing(1),
    }),
    inputWithReset: css({
      padding: 0,
      display: 'flex',
    }),
    textAreaInput: css({
      width: theme.spacing(60),
    }),
  };
};
