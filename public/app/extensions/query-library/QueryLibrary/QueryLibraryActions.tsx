import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Stack, useStyles2 } from '@grafana/ui';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';

import { showDiscardAddQueryModal } from '..';
import { QueryLibraryInteractions } from '../QueryLibraryAnalyticsEvents';
import { selectors } from '../e2e-selectors/selectors';
import { QueryTemplateRow } from '../types';
import { canEditQuery } from '../utils/identity';
import { hasUnresolvedVariables } from '../utils/templateVariables';

import { QueryDetails } from './QueryLibraryDetails';

export interface QueryLibraryActionsProps {
  selectedQueryRow: QueryTemplateRow;
  isEditingQuery: boolean;
  setIsEditingQuery: (isEditingQuery: boolean) => void;
  isSavingLoading: boolean;
  usingHistory?: boolean;
}

export function QueryLibraryActions({
  selectedQueryRow,
  isEditingQuery,
  setIsEditingQuery,
  usingHistory,
  isSavingLoading,
}: QueryLibraryActionsProps) {
  const styles = useStyles2(getStyles);
  const { setNewQuery, context, triggerAnalyticsEvent, closeDrawer, onSelectQuery } = useQueryLibraryContext();

  const hasTemplateVariables = hasUnresolvedVariables(selectedQueryRow.query);

  const {
    reset,
    formState: { isDirty },
  } = useFormContext<QueryDetails>();

  const onAddHistoryQueryToLibrary = () => {
    setNewQuery({
      ...selectedQueryRow,
      uid: undefined,
      title: t('explore.query-library.default-title', 'New query'),
    });
    setIsEditingQuery(true);
    triggerAnalyticsEvent(QueryLibraryInteractions.saveRecentQueryClicked);
  };

  if (usingHistory) {
    return (
      <Stack width="100%" justifyContent="flex-end">
        <Button data-testid={selectors.components.queryLibraryDrawer.confirm} onClick={onAddHistoryQueryToLibrary}>
          <Trans i18nKey="query-library.actions.save-history-query-button">Save query</Trans>
        </Button>
      </Stack>
    );
  }

  const resetForm = () => {
    reset();
    if (!selectedQueryRow.uid) {
      QueryLibraryInteractions.cancelSaveNewQueryClicked();
      setNewQuery(undefined);
    } else {
      QueryLibraryInteractions.cancelEditClicked();
    }
    setIsEditingQuery(false);
  };

  const onCancelEditClick = () => {
    if (isDirty) {
      showDiscardAddQueryModal(resetForm);
    } else {
      resetForm();
    }
    // Closing the drawer if not in explore or panel editor
    if (context === 'unknown') {
      closeDrawer();
    }
  };

  let saveButtonText = '';
  if (isSavingLoading) {
    saveButtonText = t('explore.query-library.saving', 'Saving...');
  } else if (context === 'unknown') {
    saveButtonText = t('explore.query-library.save-and-close', 'Save and close');
  } else {
    saveButtonText = t('explore.query-library.save', 'Save');
  }

  return (
    <Stack wrap="wrap" justifyContent="end">
      {isEditingQuery || !selectedQueryRow.uid ? (
        <div className={styles.editActionsContainer}>
          <Stack alignItems="center">
            <Button variant="secondary" onClick={onCancelEditClick}>
              <Trans i18nKey="explore.query-library.cancel">Cancel</Trans>
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={(!isDirty && !!selectedQueryRow.uid) || isSavingLoading || !canEditQuery(selectedQueryRow)}
              icon={isSavingLoading ? 'spinner' : undefined}
              data-testid={selectors.components.queryLibraryDrawer.saveQueryButton}
            >
              {saveButtonText}
            </Button>
          </Stack>
        </div>
      ) : (
        <Button
          data-testid={selectors.components.queryLibraryDrawer.confirm}
          disabled={hasTemplateVariables && context === 'explore'}
          onClick={() => {
            onSelectQuery(selectedQueryRow.query);
            //close drawer
            closeDrawer();
            // trigger analytics event
            triggerAnalyticsEvent(QueryLibraryInteractions.selectQueryClicked);
          }}
        >
          <Trans i18nKey="query-library.actions.select-query-button">Select query</Trans>
        </Button>
      )}
    </Stack>
  );
}

const getStyles = () => {
  return {
    editActionsContainer: css({
      marginLeft: 'auto',
    }),
  };
};
