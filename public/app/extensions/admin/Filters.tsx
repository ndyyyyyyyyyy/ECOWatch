import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, MultiSelect } from '@grafana/ui';
import { FilterProps } from 'app/features/admin/UserListAdminPage';

import { LICENSED_ROLE_FILTER } from './constants';

export const AdminRoleFilter = ({ filters, onChange, className }: FilterProps) => {
  const permissionOptions = useMemo(() => {
    return [
      { value: 'server_admin', label: t('admin.role-filter.server-admin-option', 'Server admin') },
      { value: 'admin_editor', label: t('admin.role-filter.admin-editor-option', 'Admin/editor') },
      { value: 'viewer', label: t('admin.role-filter.viewer-option', 'Viewer') },
    ];
  }, []);
  return (
    <MultiSelect
      value={filters.find((f) => f.name === LICENSED_ROLE_FILTER)?.value as SelectableValue[]}
      options={permissionOptions}
      onChange={(value) => {
        onChange({ name: LICENSED_ROLE_FILTER, value });
      }}
      prefix={<Icon name={'filter'} />}
      width={64}
      placeholder={t('admin.role-filter.multiselect-placeholder', 'Filter by licensed role')}
      menuShouldPortal
      className={className}
    />
  );
};
