import { Trans, t } from '@grafana/i18n';
import { EmptyState, TextLink } from '@grafana/ui';

export function GroupSyncEmptyState() {
  return (
    <EmptyState
      variant="call-to-action"
      message={t('groupsync.empty-state.title', "You haven't created any group mappings yet")}
    >
      <Trans i18nKey="groupsync.empty-state.pro-tip">
        Want to manage Grafana access through groups in your Identity Provider? Create group mappings to Grafana RBAC
        roles.{' '}
        <TextLink external href="https://grafana.com/docs/grafana/latest/administration/group-attribute-sync">
          Learn more
        </TextLink>
      </Trans>
    </EmptyState>
  );
}
