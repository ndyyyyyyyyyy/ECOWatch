import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useStyles2, Badge, Button, BadgeProps, Tooltip, Menu, Dropdown, ConfirmModal, IconButton } from '@grafana/ui';

interface Props {
  enabled: boolean;
  isNewConfig: boolean;
  onSave: () => void;
  onSaveAndEnable: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onRemove: () => void;
}

export const ConfigActionBar = ({
  enabled,
  isNewConfig,
  onSave,
  onSaveAndEnable,
  onDisable,
  onRemove,
}: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  let badgeProps: BadgeProps = { text: t('auth-config.action-bar.not-enabled-badge', 'Not enabled'), color: 'blue' };
  if (enabled) {
    badgeProps = { text: t('auth-config.action-bar.enabled-badge', 'Enabled'), color: 'green', icon: 'check' };
  } else if (!isNewConfig) {
    badgeProps = { text: t('auth-config.action-bar.not-enabled-badge', 'Not enabled'), color: 'blue' };
  }

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleDiscard = () => {
    onRemove();
    setShowConfirmModal(false);
    window.location.href = '/admin/authentication';
  };

  const additionalActionsMenu = (
    <Menu>
      <Menu.Item
        label={t('auth-config.action-bar.delete', 'Delete')}
        icon="trash-alt"
        onClick={() => {
          setShowConfirmModal(true);
        }}
      />
    </Menu>
  );

  return (
    <>
      <div className={styles.actionBarContainer}>
        <div className={styles.protocolContainer}>
          <span className={styles.protocolLabel}>
            <Trans i18nKey="auth-config.action-bar.protocol">Protocol</Trans>
          </span>
          {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
          <span>SAML 2.0</span>
        </div>
        {!isNewConfig && (
          <div className={styles.statusContainer}>
            <span className={styles.statusLabel}>
              <Trans i18nKey="auth-config.action-bar.status">Status</Trans>
            </span>
            <Badge {...badgeProps} className={styles.statusBadge} />
          </div>
        )}

        {!enabled && (
          <>
            <Button variant="secondary" onClick={onSave}>
              <Trans i18nKey="auth-config.action-bar.save-button">Save</Trans>
            </Button>
            <Button variant="primary" onClick={onSaveAndEnable}>
              <Trans i18nKey="auth-config.action-bar.save-and-enable-button">Save and enable</Trans>
            </Button>
          </>
        )}
        {enabled && (
          <>
            <Button variant="primary" onClick={onSave}>
              <Trans i18nKey="auth-config.action-bar.save-and-apply-button">Save and apply</Trans>
            </Button>
            <Tooltip
              content={t(
                'auth-config.action-bar.content-disable-button',
                'Disable will disable Grafana to not use SAML auth.'
              )}
              placement="top"
            >
              <Button variant="secondary" fill="outline" onClick={onDisable}>
                <Trans i18nKey="auth-config.action-bar.disable-button">Disable</Trans>
              </Button>
            </Tooltip>
          </>
        )}
        {!isNewConfig && (
          <Dropdown overlay={additionalActionsMenu} placement="bottom-start">
            <IconButton
              tooltip={t('auth-config.action-bar.more-actions-button', 'More actions')}
              tooltipPlacement="top"
              variant="secondary"
              name="ellipsis-v"
            />
          </Dropdown>
        )}
      </div>
      <ConfirmModal
        title={t('auth-config.config-action.confirm-modal-title', 'Delete SAML configuration')}
        body={t(
          'auth-config.config-action.confirm-modal-body',
          'Are you sure you want to permanently delete this SAML configuration? All changes made in the UI will be removed.'
        )}
        confirmText={t('auth-config.config-action.confirm-modal-confirm-text', 'Delete configuration')}
        confirmationText={enabled ? t('auth-config.config-action.confirm-modal-confirmation-text', 'delete') : ''}
        dismissText={t('auth-config.config-action.confirm-modal-dismiss-text', 'Back to editing')}
        isOpen={showConfirmModal}
        onDismiss={() => setShowConfirmModal(false)}
        onConfirm={handleDiscard}
      />
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    actionBarContainer: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
      alignItems: 'center',
      justifyContent: 'flex-end',
    }),
    iniFileLabel: css({
      display: 'flex',
      color: theme.colors.text.primary,
      justifyContent: 'flex-end',
    }),
    tooltipContainer: css({
      padding: theme.spacing(0, 1),
    }),
    statusContainer: css({
      display: 'flex',
      flexDirection: 'column',
      fontSize: theme.typography.bodySmall.fontSize,
      borderLeft: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(0, 2),
    }),
    statusBadge: css({
      span: {
        fontSize: theme.typography.size.xs,
      },
    }),
    statusLabel: css({
      color: theme.colors.text.secondary,
    }),
    protocolContainer: css({
      display: 'flex',
      flexDirection: 'column',
      fontSize: theme.typography.bodySmall.fontSize,
      paddingRight: theme.spacing(1),
    }),
    protocolLabel: css({
      color: theme.colors.text.secondary,
    }),
  };
};
