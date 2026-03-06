import { css } from '@emotion/css';
import { FormEvent, useState } from 'react';

import { dateTimeFormat, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Alert, Button, LinkButton, useStyles2, Icon, TextLink } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { UpgradeInfo } from 'app/features/admin/UpgradePage';
import { Loader } from 'app/features/plugins/admin/components/Loader';
import cardBgDarkSvg from 'img/licensing/card-bg-dark.svg';
import cardBgLightSvg from 'img/licensing/card-bg-light.svg';

import { AccessControlAction } from '../types';

import { CustomerSupportButton } from './CustomerSupportButton';
import { CardAlert, CardContent, CardState, LicenseCard } from './LicenseCard';
import { LicenseTokenUpload } from './LicenseTokenUpload';
import { EXPIRED, VALID, WARNING_RATE, LIMIT_BY_USERS, AWS_MARKEPLACE_ISSUER } from './constants';
import { postLicenseToken, renewLicenseToken } from './state/api';
import { ActiveUserStats, LicenseToken } from './types';
import {
  calculateActiveUsers,
  getRate,
  getTokenStatus,
  getTrialStatus,
  getUserStatMessage,
  getUtilStatus,
} from './utils';

export interface Props {
  token: LicenseToken | null;
  stats: ActiveUserStats | null;
  tokenRenewed?: boolean;
  tokenUpdated?: boolean;
  isLoading?: boolean;
  licensedUrl?: string;
}

export const LicenseInfo = ({ token, stats, tokenRenewed, tokenUpdated, isLoading, licensedUrl }: Props) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const tokenState = getTokenStatus(token).state;
  const utilState = getUtilStatus(token, stats).state;
  const isLicensingEditor = contextSrv.hasPermission(AccessControlAction.LicensingWrite);

  const styles = useStyles2(getStyles);

  const activeUsers = calculateActiveUsers(stats, token);
  const anonymousRatio = token?.anonymousRatio || 1;

  const onFileUpload = (event: FormEvent<HTMLInputElement>) => {
    const file = event.currentTarget?.files?.[0];

    if (file) {
      locationService.partial({ tokenUpdated: null, tokenRenewed: null });
      const reader = new FileReader();
      const readerOnLoad = () => {
        return async (e: any) => {
          setIsUploading(true);
          try {
            await postLicenseToken(e.target.result);
            locationService.partial({ tokenUpdated: true });
            setTimeout(() => {
              // reload from server to pick up the new token
              window.location.reload();
            }, 1000);
          } catch (error) {
            setIsUploading(false);
            throw error;
          }
        };
      };
      reader.onload = readerOnLoad();
      reader.readAsText(file);
    }
  };

  const onRenewClick = async () => {
    locationService.partial({ tokenUpdated: null, tokenRenewed: null });

    setIsRenewing(true);

    try {
      await renewLicenseToken();
      locationService.partial({ tokenRenewed: true });
      setTimeout(() => {
        // reload from server to pick up the new token
        window.location.reload();
      }, 1000);
    } catch (error) {
      setIsRenewing(false);
      throw error;
    }
  };

  if (!contextSrv.hasPermission(AccessControlAction.LicensingRead)) {
    return null;
  }

  if (isLoading) {
    return <Loader text={t('licensing.license-info.text-loading-licensing-info', 'Loading licensing info...')} />;
  }

  let editionNotice = t(
    'licensing.license-info.edition-notice-licensing-info',
    'You are running Grafana Enterprise without a license. The Enterprise features are disabled.'
  );
  if (token && ![VALID, EXPIRED].includes(token.status)) {
    editionNotice = t(
      'licensing.license-info.edition-notice-problem-licensing-info',
      'There is a problem with your Enterprise license token. The Enterprise features are disabled.'
    );
  }
  return !token || ![VALID, EXPIRED].includes(token.status) ? (
    <>
      <UpgradeInfo editionNotice={editionNotice} />
      <div className={styles.uploadWrapper}>
        <LicenseTokenUpload
          title={t('licensing.license-info.title-have-a-license', 'Have a license?')}
          onFileUpload={onFileUpload}
          isUploading={isUploading}
          isDisabled={!isLicensingEditor}
          licensedUrl={licensedUrl}
        />
      </div>
    </>
  ) : (
    <div>
      <h2 className={styles.title}>
        <Trans i18nKey="licensing.license-info.license-details">License details</Trans>
      </h2>
      <PageAlert {...getUtilStatus(token, stats)} orgSlug={token.slug} licenseId={token.lid} />
      <PageAlert {...getTokenStatus(token)} orgSlug={token.slug} licenseId={token.lid} />
      <PageAlert {...getTrialStatus(token)} orgSlug={token.slug} licenseId={token.lid} />
      {tokenUpdated && (
        <Alert
          title={t(
            'licensing.license-info.license-alert',
            'License token uploaded. Restart Grafana for the changes to take effect.'
          )}
          severity="success"
          onRemove={() => locationService.partial({ tokenUpdated: null })}
        />
      )}
      {tokenRenewed && (
        <Alert
          title={t('licensing.license-info.title-license-token-renewed', 'License token renewed.')}
          severity="success"
          onRemove={() => locationService.partial({ tokenRenewed: null })}
        />
      )}
      <div className={styles.row}>
        <LicenseCard
          title={t('licensing.license-info.title-license', 'License')}
          className={styles.licenseCard}
          footer={
            <LinkButton
              variant="secondary"
              href={token.details_url || `${token.iss}/licenses/${token.lid}`}
              aria-label={t(
                'licensing.license-info.aria-label-details-about-license-grafana-cloud',
                'View details about your license in Grafana Cloud'
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Trans i18nKey="licensing.license-info.license-details">License details</Trans>
            </LinkButton>
          }
        >
          <CardContent
            content={[
              {
                name:
                  token.prod?.length <= 1
                    ? t('licensing.license-info.card-content-product', 'Product')
                    : t('licensing.license-info.card-content-products', 'Products'),
                value:
                  token.prod?.length <= 1 ? (
                    token.prod[0] || t('licensing.license-info.card-content-none', 'None')
                  ) : (
                    <ul>
                      {token.prod?.map((product) => (
                        <li key={product}>{product}</li>
                      ))}
                    </ul>
                  ),
              },
              token.iss === AWS_MARKEPLACE_ISSUER && token.account
                ? { name: t('licensing.license-info.card-content-account', 'AWS Account'), value: token.account }
                : { name: t('licensing.license-info.card-content-company', 'Company'), value: token.company },
              { name: t('licensing.license-info.card-content-lid', 'License ID'), value: token.lid },
              token.iss === AWS_MARKEPLACE_ISSUER
                ? null
                : {
                    name: t('licensing.license-info.card-content-url-name', 'URL'),
                    value: token.sub,
                    tooltip: t(
                      'licensing.license-info.card-content-url-tooltip',
                      'License URL is the root URL of your Grafana instance. The license will not work on an instance of Grafana with a different root URL.'
                    ),
                  },
              {
                name: t('licensing.license-info.card-content-purchase-date', 'Purchase date'),
                value: dateTimeFormat(token.nbf * 1000),
              },
              token.iss === AWS_MARKEPLACE_ISSUER
                ? null
                : {
                    name: t('licensing.license-info.card-content-license-expires', 'License expires'),
                    value: dateTimeFormat(token.lexp * 1000),
                    highlight: !!getTokenStatus(token)?.state,
                    tooltip: t(
                      'licensing.license-info.card-content-license-expires-tooltip',
                      'The license expiration date is the date when the current license is no longer active. As the license expiration date approaches, Grafana Enterprise displays a banner.'
                    ),
                  },
              token.iss === AWS_MARKEPLACE_ISSUER
                ? null
                : {
                    name: t('licensing.license-info.card-content-usage-billing', 'Usage billing'),
                    value: token.usage_billing
                      ? t('licensing.license-info.card-content-usage-billing-on', 'On')
                      : t('licensing.license-info.card-content-token-usage-billing-off', 'Off'),
                    tooltip: t(
                      'licensing.license-info.card-content-usage-billing-tooltip',
                      'You can request Grafana Labs to turn on usage billing to allow an unlimited number of active users. When usage billing is enabled, Grafana does not enforce active user limits or display warning banners. Instead, you are charged for active users above the limit, according to your customer contract.'
                    ),
                  },
            ]}
          />
        </LicenseCard>
        <LicenseCard
          {...getTokenStatus(token)}
          title={t('licensing.license-info.title-token', 'Token')}
          footer={
            <div className={styles.row}>
              {token.iss !== AWS_MARKEPLACE_ISSUER && (
                <LicenseTokenUpload
                  onFileUpload={onFileUpload}
                  isUploading={isUploading}
                  isDisabled={!isLicensingEditor}
                />
              )}
              {isRenewing ? (
                <span>
                  <Trans i18nKey="licensing.license-info.renewing"> (Renewing...)</Trans>
                </span>
              ) : (
                <Button variant="secondary" onClick={onRenewClick} disabled={!isLicensingEditor}>
                  <Trans i18nKey="licensing.license-info.renew-token">Renew token</Trans>
                </Button>
              )}
            </div>
          }
        >
          <>
            {tokenState && (
              <CardAlert
                title={t(
                  'licensing.license-info.title-contact-support-renew-token-visit-cloud',
                  'Contact support to renew your token, or visit the Cloud portal to learn more.'
                )}
                state={tokenState}
                orgSlug={token.slug}
                licenseId={token.lid}
              />
            )}
            <div className={styles.message}>
              <Icon name={'document-info'} />
              <Trans i18nKey="licensing.license-info.license-token-info">
                Read about{' '}
                <TextLink
                  href={'https://grafana.com/docs/grafana/latest/enterprise/license/license-expiration/'}
                  external
                >
                  license expiration
                </TextLink>{' '}
                and{' '}
                <TextLink
                  href={'https://grafana.com/docs/grafana/latest/enterprise/license/activate-license/'}
                  external
                >
                  license activation
                </TextLink>
                .
              </Trans>
            </div>
            <CardContent
              content={[
                { name: t('licensing.license-info.card-content-token-id', 'Token ID'), value: token.jti },
                {
                  name: t('licensing.license-info.card-content-token-issued', 'Token issued'),
                  value: dateTimeFormat(token.iat * 1000),
                },
                {
                  name: t('licensing.license-info.card-content-token-expires', 'Token expires'),
                  value: dateTimeFormat(token.exp * 1000),
                  highlight: !!getTokenStatus(token)?.state,
                  tooltip: t(
                    'licensing.license-info.card-content-token-auto-update',
                    'Grafana automatically updates the token before it expires. If your token is not updating, contact support.'
                  ),
                },
              ]}
              state={tokenState}
            />
          </>
        </LicenseCard>
        <LicenseCard
          {...getUtilStatus(token, stats)}
          title={t('licensing.license-info.title-utilization', 'Utilization')}
          footer={
            <small className={styles.footerText}>
              <Trans i18nKey="licensing.license-info.utilization-footer">
                Utilization of licenced users is determined based on signed-in users&apos; activity in the past 30 days.
              </Trans>
            </small>
          }
        >
          <>
            <div className={styles.message}>
              <Icon name={'document-info'} />
              <Trans i18nKey="licensing.license-info.utilization-info">
                Read about{' '}
                <TextLink
                  href={
                    'https://grafana.com/docs/grafana/latest/enterprise/license/license-restrictions/#active-users-limit'
                  }
                  external
                >
                  active user limits
                </TextLink>{' '}
                and{' '}
                <TextLink
                  href={
                    'https://grafana.com/docs/grafana/latest/enterprise/license/license-restrictions/#concurrent-sessions-limit'
                  }
                  external
                >
                  concurrent session limits
                </TextLink>
                .
              </Trans>
            </div>

            {token.limit_by === LIMIT_BY_USERS && (
              <CardContent
                content={[
                  {
                    name: t('licensing.license-info.card-content-active-licensed-users', 'Active licensed users'),
                    value: getUserStatMessage(token.included_users, activeUsers),
                    highlight: getRate(token.included_users, activeUsers) >= WARNING_RATE,
                  },
                  ...(config.anonymousEnabled
                    ? [
                        {
                          name: t('licensing.license-info.card-content-authenticated-users', 'Authenticated users'),
                          value: stats?.active_users || 0,
                          indentLevel: 1,
                        },
                        {
                          name: t('licensing.license-info.card-content-anonymous-users', 'Anonymous users'),
                          value: Math.floor((stats?.active_anonymous_devices || 0) / anonymousRatio),
                          tooltip: t(
                            'licensing.license-info.card-content-anonymous-users-tooltip',
                            'For every {{count}} anonymous devices, Grafana counts 1 user.',
                            { count: anonymousRatio }
                          ),
                          indentLevel: 1,
                        },
                      ]
                    : []),
                ]}
                state={utilState}
              />
            )}
          </>
        </LicenseCard>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const licenseCardBackground = theme.isLight ? cardBgLightSvg : cardBgDarkSvg;
  return {
    title: css({
      margin: theme.spacing(4, 0),
    }),
    infoText: css({
      fontSize: theme.typography.size.sm,
    }),
    uploadWrapper: css({
      marginLeft: '79px',
    }),
    row: css({
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%',
      flexWrap: 'wrap',
      gap: theme.spacing(2),

      '& > div': {
        flex: '1 1 340px',
      },
    }),
    footerText: css({
      marginBottom: theme.spacing(2),
    }),
    licenseCard: css({
      background: `url('${licenseCardBackground}') center no-repeat`,
      backgroundSize: 'cover',
    }),
    message: css({
      height: '70px',
      a: {
        color: theme.colors.text.link,

        '&:hover': {
          textDecoration: 'underline',
        },
      },

      svg: {
        marginRight: theme.spacing(0.5),
      },
    }),
  };
};

type PageAlertProps = {
  state?: CardState;
  message?: string;
  title: string;
  orgSlug: string;
  licenseId: string;
};

const PageAlert = ({ state, message, title, orgSlug, licenseId }: PageAlertProps) => {
  const styles = useStyles2(getPageAlertStyles);
  if (!state) {
    return null;
  }

  return (
    <Alert title={title} severity={state || undefined}>
      <div className={styles.container}>
        <div>
          <p>{message}</p>
          <a
            className={styles.link}
            href={'https://grafana.com/docs/grafana/latest/enterprise/license/license-restrictions/'}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Trans i18nKey="licensing.page-alert.learn-about-enterprise-licenses">
              Learn about Enterprise licenses
            </Trans>
          </a>
        </div>
        <CustomerSupportButton orgSlug={orgSlug} licenseId={licenseId} />
      </div>
    </Alert>
  );
};

const getPageAlertStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      width: '100%',
    }),
    link: css({
      fontSize: theme.typography.bodySmall.fontSize,
      textDecoration: 'underline',
      color: theme.colors.text.secondary,

      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
};
