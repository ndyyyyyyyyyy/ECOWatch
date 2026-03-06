import { css } from '@emotion/css';

import { CoreApp, GrafanaTheme2, colorManipulator } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Button, Stack, useStyles2 } from '@grafana/ui';

import { useQueryLibrarySave } from './hooks/useQueryLibrarySave';

interface QueryLibraryEditingHeaderProps {
  query: DataQuery;
  app?: CoreApp;
  queryLibraryRef?: string;
  onCancelEdit?: () => void;
  onUpdateSuccess?: () => void;
  onSelectQuery?: (query: DataQuery) => void;
}

export function QueryLibraryEditingHeader({
  query,
  app,
  queryLibraryRef,
  onCancelEdit,
  onUpdateSuccess,
  onSelectQuery,
}: QueryLibraryEditingHeaderProps) {
  const styles = useStyles2(getStyles);
  const { updateQuery, isEnabled } = useQueryLibrarySave();

  const isEditingQueryLibrary = queryLibraryRef !== undefined;

  if (!isEnabled() || !isEditingQueryLibrary) {
    return null;
  }

  const handleSave = () => {
    if (queryLibraryRef) {
      updateQuery(
        query,
        {
          context: app,
          queryLibraryRef: queryLibraryRef,
        },
        onUpdateSuccess,
        onSelectQuery
      );
    }
  };

  return (
    <div className={styles.header}>
      <div className={styles.headerText}>{t('explore.query-library.editing-title', 'Editing from saved queries')}</div>
      <Stack direction="row" gap={1} wrap="nowrap">
        <Button variant="secondary" size="sm" fill="text" onClick={onCancelEdit} className={styles.discardButton}>
          {t('explore.query-library.discard', 'Discard')}
        </Button>
        <Button variant="primary" size="sm" fill="outline" onClick={handleSave} className={styles.saveButton}>
          {t('explore.query-library.save-return', 'Save and return to saved queries')}
        </Button>
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const contrastColor = theme.colors.getContrastText(theme.colors.info.main);
  const lighterBackgroundColor = colorManipulator.lighten(theme.colors.info.main, 0.1);

  return {
    header: css({
      backgroundColor: theme.colors.info.main,
      color: contrastColor,
      padding: theme.spacing(1.5, 2),
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: '44px',
      borderTopLeftRadius: theme.shape.radius.default,
      borderTopRightRadius: theme.shape.radius.default,
      borderBottomLeftRadius: 'unset',
      borderBottomRightRadius: 'unset',

      [theme.breakpoints.down('md')]: {
        gap: theme.spacing(0.5),
        padding: theme.spacing(0.75, 1),
        minHeight: 'auto',
      },
    }),
    headerText: css({
      color: contrastColor,
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.body.fontSize,

      [theme.breakpoints.down('md')]: {
        fontSize: theme.typography.bodySmall.fontSize,
        flex: 1,
      },
    }),
    discardButton: css({
      color: contrastColor,
      '&:hover': {
        color: contrastColor,
        backgroundColor: lighterBackgroundColor,
      },
    }),
    saveButton: css({
      color: contrastColor,
      borderColor: contrastColor,
      '&:hover': {
        color: contrastColor,
        borderColor: contrastColor,
        backgroundColor: lighterBackgroundColor,
      },
    }),
  };
};
