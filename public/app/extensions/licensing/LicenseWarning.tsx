import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, TextLink, useStyles } from '@grafana/ui';

interface WarningProps {
  title: string;
  subTitle: JSX.Element;
  severity: 'info' | 'error';
  onButtonClick?: () => void;
  buttonText?: string;
}

const Warning = ({ title, subTitle, severity, onButtonClick, buttonText }: WarningProps) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.container}>
      <div className="page-container">
        <Alert title={title} severity={severity} buttonContent={buttonText} onRemove={onButtonClick}>
          {subTitle}
        </Alert>
      </div>
    </div>
  );
};

interface LicensingLinkProps {
  isLicensingReader: boolean;
  children: React.ReactNode;
}

export const LicensingLink = ({ isLicensingReader, children }: LicensingLinkProps) => {
  if (isLicensingReader) {
    return <a href="/admin/licensing">{children}</a>;
  }

  return (
    <a
      href="https://grafana.com/docs/grafana/latest/enterprise/license-expiration/"
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  );
};

interface HasExpiredProps {
  isLicensingReader: boolean;
}

export const HasExpired = ({ isLicensingReader }: HasExpiredProps) => {
  return (
    <Warning
      title={t(
        'licensing.has-expired.title-your-grafana-enterprise-license-has-expired',
        'Your Grafana Enterprise license has expired'
      )}
      subTitle={
        <>
          <Trans i18nKey="licensing.has-expired.sub-title-licensing-reader">
            <LicensingLink isLicensingReader={isLicensingReader}>Some features</LicensingLink> have been disabled.
          </Trans>
        </>
      }
      severity="error"
    />
  );
};

interface IsInvalidProps {
  isLicensingReader: boolean;
}

export const IsInvalid = ({ isLicensingReader }: IsInvalidProps) => {
  return (
    <Warning
      title={t(
        'licensing.is-invalid.title-your-grafana-enterprise-license-is-invalid',
        'Your Grafana Enterprise license is invalid'
      )}
      subTitle={
        <>
          <Trans i18nKey="licensing.is-invalid.sub-title-licensing-reader">
            <LicensingLink isLicensingReader={isLicensingReader}>Some features</LicensingLink> have been disabled.
          </Trans>
        </>
      }
      severity="error"
    />
  );
};

interface ExpiresSoonProps {
  days: number;
  onCloseWarning?(): void;
  isLicensingReader: boolean;
}

export const ExpiresSoon = ({ days, onCloseWarning, isLicensingReader }: ExpiresSoonProps) => {
  return (
    <Warning
      onButtonClick={onCloseWarning}
      title={t(
        'licensing.expires-soon.title-grafana-enterprise-license-expire',
        'Your Grafana Enterprise license will expire soon'
      )}
      subTitle={
        <>
          <Trans i18nKey="licensing.expires-soon.sub-title-license-expiration" count={days}>
            {{ count: days }} days remaining, after which{' '}
            <LicensingLink isLicensingReader={isLicensingReader}>Enterprise features will be disabled.</LicensingLink>
          </Trans>
        </>
      }
      severity="info"
      buttonText="Dismiss"
    />
  );
};

interface TokenExpiresSoonProps {
  days: number;
  onCloseWarning?(): void;
  isLicensingReader: boolean;
}

export const TokenExpiresSoon = ({ days, onCloseWarning, isLicensingReader }: TokenExpiresSoonProps) => {
  return (
    <Warning
      onButtonClick={onCloseWarning}
      title={t(
        'licensing.token-expires-soon.title-grafana-enterprise-token-needs-renewed',
        'Your Grafana Enterprise token needs to be renewed'
      )}
      subTitle={
        <>
          <Trans i18nKey="licensing.token-expires-soon.sub-title-token-expiration" count={days}>
            Your license token has {{ count: days }} days remaining, after which{' '}
            <LicensingLink isLicensingReader={isLicensingReader}>Enterprise features will be disabled.</LicensingLink>
          </Trans>
        </>
      }
      severity="info"
      buttonText="Dismiss"
    />
  );
};

interface MaxUsersReachedProps {
  activeUsers: number;
  maxUsers: number;
  onRefreshWarning?: () => void;
  slug?: string;
}

export const MaxUsersReached = ({ activeUsers, maxUsers, slug, onRefreshWarning }: MaxUsersReachedProps) => {
  return (
    <Warning
      onButtonClick={onRefreshWarning}
      title={t(
        'licensing.max-users-reached.title-exceeded-included-number-active-users',
        'You have exceeded the included number of active users'
      )}
      subTitle={
        <>
          <Trans i18nKey="licensing.max-users-reached.upgrade-your-license-subtitle" count={activeUsers}>
            Your Grafana Enterprise license includes {{ maxUsers }} active users; you currently have{' '}
            {{ count: activeUsers }} active users.{' '}
          </Trans>

          {slug ? (
            <Trans i18nKey="licensing.max-users-reached.upgrade-your-license-link">
              Please{' '}
              <TextLink external href={'https://grafana.com/orgs/' + slug + '/licenses'}>
                upgrade your license.
              </TextLink>
            </Trans>
          ) : (
            <Trans i18nKey="licensing.max-users-reached.upgrade-your-license-no-link">
              Please upgrade your license.
            </Trans>
          )}
        </>
      }
      severity="error"
      buttonText="Refresh"
    />
  );
};

export const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css({
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      zIndex: 3,
    }),
  };
};
