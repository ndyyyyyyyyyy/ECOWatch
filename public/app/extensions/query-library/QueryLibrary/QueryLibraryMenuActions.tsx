import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { IconButton, Menu, Dropdown, useStyles2 } from '@grafana/ui';
import { useDeleteQueryMutation, useUpdateQueryMutation } from 'app/extensions/api/clients/queries/v1beta1';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { notifyApp } from '../../../core/actions';
import { createSuccessNotification } from '../../../core/copy/appNotification';
import { dispatch } from '../../../store/store';
import { ShowConfirmModalEvent } from '../../../types/events';
import { QueryLibraryInteractions } from '../QueryLibraryAnalyticsEvents';
import { selectors } from '../e2e-selectors/selectors';
import { QueryTemplateRow } from '../types';
import { canEditQuery } from '../utils/identity';

export interface QueryLibraryMenuActionsProps {
  selectedQueryRow: QueryTemplateRow;
  setIsEditingQuery: (isEditingQuery: boolean) => void;
  onEditQuerySuccess: (uid: string, isNew?: boolean) => void;
}

export function QueryLibraryMenuActions({
  selectedQueryRow,
  setIsEditingQuery,
  onEditQuerySuccess,
}: QueryLibraryMenuActionsProps) {
  const { setNewQuery } = useQueryLibraryContext();

  const [deleteQueryTemplate] = useDeleteQueryMutation();
  const [editQueryTemplate, { isLoading }] = useUpdateQueryMutation();
  const { triggerAnalyticsEvent } = useQueryLibraryContext();

  const { isLocked } = selectedQueryRow;

  const styles = useStyles2(getStyles);

  const onDeleteQuery = (queryUid: string) => {
    const performDelete = async (queryUid: string) => {
      await deleteQueryTemplate({
        name: queryUid,
      }).unwrap();
      dispatch(notifyApp(createSuccessNotification(t('query-library.notifications.query-deleted', 'Query deleted'))));
      triggerAnalyticsEvent(QueryLibraryInteractions.deleteQueryClicked);
    };

    getAppEvents().publish(
      new ShowConfirmModalEvent({
        title: t('query-library.delete-modal.title', 'Delete query'),
        text: t(
          'query-library.delete-modal.body-text',
          "You're about to remove this saved query. This action cannot be undone. Do you want to continue?"
        ),
        yesText: t('query-library.delete-modal.confirm-button', 'Delete query'),
        icon: 'trash-alt',
        onConfirm: () => performDelete(queryUid),
      })
    );
  };

  const onDuplicateQuery = () => {
    triggerAnalyticsEvent(QueryLibraryInteractions.duplicateQueryClicked);
    setNewQuery({
      ...selectedQueryRow,
      uid: undefined,
      title: `${selectedQueryRow.title} ${t('query-library.actions.duplicate-query-title-copy', 'Copy')}`,
    });
    setIsEditingQuery(true);
  };

  const onLockToggle = async () => {
    if (!selectedQueryRow.uid) {
      return;
    }
    triggerAnalyticsEvent(QueryLibraryInteractions.lockQueryClicked, {
      isLocked: !isLocked,
    });
    await editQueryTemplate({
      name: selectedQueryRow.uid || '',
      patch: {
        spec: {
          isLocked: !isLocked,
        },
      },
    }).unwrap();

    onEditQuerySuccess(selectedQueryRow.uid);
  };

  const menu = (
    <Menu>
      <Menu.Item
        data-testid={selectors.components.queryLibraryDrawer.duplicate}
        label={t('query-library.actions.duplicate-query-button', 'Duplicate query')}
        icon="copy"
        onClick={onDuplicateQuery}
      />
      <Menu.Item
        label={
          isLocked
            ? t('query-library.actions.unlock-query-button', 'Unlock query')
            : t('query-library.actions.lock-query-button', 'Lock query')
        }
        icon={isLocked ? 'unlock' : 'lock'}
        onClick={onLockToggle}
      />
      <Menu.Divider />
      <Menu.Item
        label={t('query-library.actions.delete-query-button', 'Delete query')}
        icon="trash-alt"
        onClick={() => onDeleteQuery(selectedQueryRow.uid ?? '')}
        data-testid={selectors.components.queryLibraryDrawer.delete}
        disabled={selectedQueryRow.isLocked}
      />
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-end" offset={[16, 0]}>
      <IconButton
        name="ellipsis-v"
        variant="secondary"
        size="lg"
        className={styles.menuButton}
        aria-label={t('query-library.actions.menu-button', 'Saved query actions')}
        disabled={!canEditQuery(selectedQueryRow) || !selectedQueryRow.uid || isLoading}
      />
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  menuButton: css({
    height: theme.spacing(4),
  }),
});
