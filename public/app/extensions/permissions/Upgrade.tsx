import { t } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';
import { UpgradeBox, UpgradeContent, UpgradeContentProps } from 'app/core/components/Upgrade/UpgradeBox';
import { useInitDataSourceSettings } from 'app/features/datasources/state/hooks';

export type UpgradePageProps = {
  uid: string;
};

export const Upgrade = ({ uid }: UpgradePageProps) => {
  useInitDataSourceSettings(uid);

  return (
    <>
      <UpgradeBox featureName={'data source permissions'} featureId={'data-source-permissions'} />
      <PermissionsUpgradeContent />
    </>
  );
};

export interface PermissionsUpgradeContentProps {
  action?: UpgradeContentProps['action'];
}

export const PermissionsUpgradeContent = ({ action }: PermissionsUpgradeContentProps) => {
  const theme = useTheme2();

  return (
    <UpgradeContent
      action={action}
      featureName={'data source permissions'}
      description={t(
        'permissions.permissions-upgrade-content.description-source-permissions-protect-sensitive-limiting-access',
        'With data source permissions, you can protect sensitive data by limiting access to this data source to specific users, teams, and roles.'
      )}
      listItems={[
        t(
          'permissions.permissions-upgrade-content.source-permissions-protect-sensitive-data-list-item',
          'Protect sensitive data, like security logs, production databases, and personally-identifiable information'
        ),
        t(
          'permissions.permissions-upgrade-content.source-permissions-protect-clean-experience-list-item',
          'Clean up users’ experience by hiding data sources they don’t need to use'
        ),
        t(
          'permissions.permissions-upgrade-content.source-permissions-protect-share-access-list-item',
          'Share Grafana access more freely, knowing that users will not unwittingly see sensitive data'
        ),
      ]}
      image={`ds-permissions-${theme.isLight ? 'light' : 'dark'}.png`}
      featureUrl={'https://grafana.com/docs/grafana/latest/enterprise/datasource_permissions'}
    />
  );
};

export default Upgrade;
