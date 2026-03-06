import { css } from '@emotion/css';
import { FormEvent } from 'react';

import { Trans } from '@grafana/i18n';
import { Button, FileUpload, stylesFactory } from '@grafana/ui';

interface Props {
  isUploading: boolean;
  title?: string;
  onFileUpload: (event: FormEvent<HTMLInputElement>) => void;
  isDisabled?: boolean;
  licensedUrl?: string;
}

export const LicenseTokenUpload = ({ isUploading, title, onFileUpload, isDisabled, licensedUrl }: Props) => {
  const styles = getStyles();

  return (
    <>
      {title && <h2 className={styles.title}>{title}</h2>}
      {isUploading ? (
        <Button disabled={true}>
          <Trans i18nKey="licensing.license-token-upload.uploading">Uploading…</Trans>
        </Button>
      ) : isDisabled ? (
        <Button disabled={true}>
          <Trans i18nKey="licensing.license-token-upload.upload-a-new-token">Upload a new token</Trans>
        </Button>
      ) : (
        <FileUpload onFileUpload={onFileUpload} accept=".jwt">
          <Trans i18nKey="licensing.license-token-upload.upload-a-new-token">Upload a new token</Trans>
        </FileUpload>
      )}
      {licensedUrl && (
        <p className={styles.instanceUrl}>
          <Trans i18nKey="licensing.license-token-upload.instance-url" values={{ licensedUrl }}>
            Instance URL: <code>{'{{licensedUrl}}'}</code>
          </Trans>
        </p>
      )}
    </>
  );
};

const getStyles = stylesFactory(() => {
  return {
    title: css({
      marginTop: '30px',
      marginBottom: '20px',
    }),
    instanceUrl: css({
      marginTop: '10px',
    }),
  };
});
