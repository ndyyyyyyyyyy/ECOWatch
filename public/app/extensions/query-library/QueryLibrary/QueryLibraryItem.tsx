import { css, cx } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, Text, useStyles2, Badge } from '@grafana/ui';
import { attachSkeleton, SkeletonComponent } from '@grafana/ui/unstable';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import icnDatasourceSvg from 'img/icn-datasource.svg';

import { QueryLibraryInteractions } from '../QueryLibraryAnalyticsEvents';
import { selectors } from '../e2e-selectors/selectors';
import { QueryTemplateRow } from '../types';
import { useDatasource } from '../utils/useDatasource';

export interface QueryListItemProps {
  isSelected?: boolean;
  isFavorite?: boolean;
  onFavorite?: () => void;
  onUnfavorite?: () => void;
  isHighlighted?: boolean;
  onSelectQueryRow: (query: QueryTemplateRow) => void;
  queryRow: QueryTemplateRow;
  favoritesEnabled?: boolean;
  usingHistory?: boolean;
  isNew?: boolean;
  disabled?: boolean;
  setIsEditingQuery?: (isEditingQuery: boolean) => void;
}

const RADIO_GROUP_NAME = 'query-library-list';

function QueryLibraryItemComponent({
  isSelected,
  isHighlighted,
  isFavorite,
  onFavorite,
  onUnfavorite,
  onSelectQueryRow,
  queryRow,
  favoritesEnabled,
  usingHistory,
  isNew,
  disabled,
  setIsEditingQuery,
}: QueryListItemProps) {
  const { value: datasourceApi } = useDatasource(queryRow.datasourceRef);
  const styles = useStyles2(getStyles);

  const { setNewQuery, triggerAnalyticsEvent } = useQueryLibraryContext();

  const onAddHistoryQueryToLibrary = () => {
    setNewQuery({
      ...queryRow,
      uid: undefined,
      title: t('explore.query-library.default-title', 'New query'),
    });
    setIsEditingQuery?.(true);
    triggerAnalyticsEvent(QueryLibraryInteractions.saveRecentQueryClicked);
  };

  return (
    <label
      data-testid={selectors.components.queryLibraryDrawer.item(queryRow.title ?? '')}
      data-query-uid={queryRow.uid}
      className={cx(styles.label, isHighlighted && styles.highlighted, disabled && styles.disabled)}
      htmlFor={queryRow.uid}
    >
      <input
        // only the selected item should be tabbable
        // arrow keys should navigate between items
        tabIndex={isSelected ? 0 : -1}
        type="radio"
        id={queryRow.uid}
        name={RADIO_GROUP_NAME}
        className={styles.input}
        onChange={() => onSelectQueryRow(queryRow)}
        checked={isSelected}
        disabled={disabled}
      />
      <Stack alignItems="center" justifyContent="space-between">
        <Stack minWidth={0}>
          <img
            className={styles.logo}
            src={datasourceApi?.meta.info.logos.small || icnDatasourceSvg}
            alt={datasourceApi?.type}
          />
          <Text truncate>{queryRow.title ?? ''}</Text>
        </Stack>
        {!isNew && favoritesEnabled && (
          <IconButton
            id={`favorite-${queryRow.uid}`}
            tooltip={
              isFavorite
                ? t('query-library.item.unfavorite', 'Unfavorite')
                : t('query-library.item.favorite', 'Favorite')
            }
            name={isFavorite ? 'favorite' : 'star'}
            onClick={isFavorite ? onUnfavorite : onFavorite}
            iconType={isFavorite ? 'mono' : 'default'}
            disabled={disabled}
          />
        )}

        {usingHistory && (
          <IconButton
            id={`history-${queryRow.uid}`}
            tooltip={t('query-library.item.add-to-library', 'Save query')}
            name="plus-circle"
            onClick={onAddHistoryQueryToLibrary}
            iconType="default"
          />
        )}
        {isNew && (
          <Badge
            data-testid={selectors.components.queryLibraryDrawer.newBadge}
            text={t('query-library.item.new', 'New')}
            color="orange"
          />
        )}
      </Stack>
    </label>
  );
}

const QueryLibraryItemSkeleton: SkeletonComponent = ({ rootProps }) => {
  const styles = useStyles2(getStyles);
  const skeletonStyles = useStyles2(getSkeletonStyles);
  return (
    <div className={styles.label} {...rootProps}>
      <div className={skeletonStyles.wrapper}>
        <Skeleton containerClassName={skeletonStyles.icon} circle width={16} height={16} />
        <Skeleton width={120} />
      </div>
    </div>
  );
};

const getSkeletonStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
    overflow: 'hidden',
  }),
  icon: css({
    display: 'block',
    lineHeight: 1,
  }),
});

export const QueryLibraryItem = attachSkeleton(QueryLibraryItemComponent, QueryLibraryItemSkeleton);

const getStyles = (theme: GrafanaTheme2) => ({
  input: css({
    cursor: 'pointer',
    inset: 0,
    opacity: 0,
    position: 'absolute',
  }),
  label: css({
    width: '100%',
    padding: theme.spacing(2, 2, 2, 1),
    position: 'relative',

    // Add transitions for smooth highlighting fade-out
    '@media (prefers-reduced-motion: no-preference)': {
      transition: theme.transitions.create(['background-color', 'border-color'], {
        duration: theme.transitions.duration.standard,
      }),
    },

    ':has(:checked)': {
      backgroundColor: theme.colors.action.selected,
    },

    ':has(:focus-visible)': css({
      backgroundColor: theme.colors.action.hover,
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
    }),
  }),
  highlighted: css({
    backgroundColor: theme.colors.success.transparent,
    border: `2px solid ${theme.colors.success.border}`,
    borderRadius: theme.shape.radius.default,

    // Override selected state when highlighted
    ':has(:checked)': {
      backgroundColor: theme.colors.success.transparent,
      border: `2px solid ${theme.colors.success.border}`,
    },
  }),
  logo: css({
    width: '16px',
  }),
  disabled: css({
    opacity: 0.5,
    cursor: 'not-allowed',
  }),
});
