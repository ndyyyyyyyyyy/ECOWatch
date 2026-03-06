import { css } from '@emotion/css';
import { useId, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import Skeleton from 'react-loading-skeleton';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Avatar,
  Box,
  Checkbox,
  Button,
  Field,
  Icon,
  Input,
  Spinner,
  Stack,
  TagsInput,
  Text,
  useStyles2,
} from '@grafana/ui';
import { attachSkeleton, SkeletonComponent } from '@grafana/ui/unstable';
import { generatedAPI } from 'app/extensions/api/clients/queries/v1beta1/endpoints.gen';
import { useQueryLibraryContext } from 'app/features/explore/QueryLibrary/QueryLibraryContext';
import icnDatasourceSvg from 'img/icn-datasource.svg';

import { QueryLibraryInteractions } from '../QueryLibraryAnalyticsEvents';
import { selectors } from '../e2e-selectors/selectors';
import { QueryTemplateRow } from '../types';
import { canEditQuery } from '../utils/identity';
import { onOpenInExplore } from '../utils/navigation';
import { hasUnresolvedVariables } from '../utils/templateVariables';
import { useDatasource } from '../utils/useDatasource';

import { QueryLibraryEditor } from './QueryLibraryEditor';
import { QueryLibraryMenuActions } from './QueryLibraryMenuActions';

export type QueryDetails = {
  title: string;
  description: string;
  isVisible: boolean;
  tags: string[];
};

export interface QueryDetailsProps {
  query: QueryTemplateRow;
  editingQuery: boolean;
  setEditingQuery: (editingQuery: boolean) => void;
  onCloseDrawer?: () => void;
  onEditQuerySuccess: (uid: string, isNew?: boolean) => void;
  usingHistory?: boolean;
}

function QueryLibraryDetailsComponent({
  query,
  editingQuery,
  setEditingQuery,
  onCloseDrawer,
  onEditQuerySuccess,
  usingHistory,
}: QueryDetailsProps) {
  const { register, setFocus, control } = useFormContext<QueryDetails>();
  const { context, triggerAnalyticsEvent } = useQueryLibraryContext();

  const { isFetching } = generatedAPI.endpoints.listQuery.useQueryState({});
  const { value: datasourceApi, loading: datasourceApiLoading } = useDatasource(query.datasourceRef);
  const formattedTime = dateTime(query.createdAtTimestamp).format('ddd MMM DD YYYY HH:mm [GMT]ZZ');

  const { isLocked } = query;
  const hasTemplateVariables = hasUnresolvedVariables(query.query);
  // Always prevent QueryEditor rendering when variables detected to avoid crashes
  const QueryEditor =
    datasourceApi && !hasTemplateVariables ? (
      <QueryLibraryEditor datasource={datasourceApi} query={query.query} />
    ) : null;

  const AUTHOR_ID = useId();
  const DATASOURCE_ID = useId();
  const DESCRIPTION_ID = useId();
  const DATE_ADDED_ID = useId();
  const IS_VISIBLE_ID = useId();
  const TAGS_ID = 'tags';
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (editingQuery) {
      setFocus('title');
    }
  }, [setFocus, editingQuery]);

  return (
    <Stack direction="column" justifyContent="space-between" flex={1} height="100%">
      <Box minWidth={0}>
        <Box
          display="flex"
          gap={1}
          alignItems="center"
          justifyContent="space-between"
          marginBottom={editingQuery ? 0 : 2}
        >
          {!usingHistory && (
            <Stack gap={1} alignItems="center" minWidth={0} flex={1}>
              <img
                className={styles.logo}
                src={datasourceApi?.meta.info.logos.small || icnDatasourceSvg}
                alt={datasourceApi?.type}
              />
              {editingQuery ? (
                <Box flex={1} marginBottom={2}>
                  <Field label={t('query-library.query-details.title', 'Title')} noMargin>
                    <Input
                      id="title"
                      data-testid={selectors.components.queryLibraryDrawer.titleInput}
                      {...register('title')}
                    />
                  </Field>
                </Box>
              ) : (
                <>
                  <Text variant="h5" truncate>
                    {query.title ?? ''}
                  </Text>
                  {isLocked && <Icon name="lock" />}
                </>
              )}
            </Stack>
          )}
          {isFetching && <Spinner />}
          {!editingQuery && !usingHistory && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                triggerAnalyticsEvent(QueryLibraryInteractions.editQueryClicked);
                setEditingQuery(true);
              }}
              icon="pen"
              iconPlacement="right"
              disabled={isLocked || !canEditQuery(query)}
              aria-label={t('query-library.query-details.edit-button', 'Edit query')}
            >
              <Trans i18nKey="query-library.query-details.edit-button-short">Edit</Trans>
            </Button>
          )}
          {!editingQuery && !usingHistory && (
            <QueryLibraryMenuActions
              selectedQueryRow={query}
              setIsEditingQuery={setEditingQuery}
              onEditQuerySuccess={onEditQuerySuccess}
            />
          )}
        </Box>
        <Box marginBottom={2}>
          {hasTemplateVariables && !editingQuery && (
            <Alert
              severity="warning"
              title={t('query-library.template-variables-warning.title', 'Query formatting unavailable')}
            >
              {t(
                'query-library.template-variables-warning.message',
                'This query contains variables that can’t be resolved in this context, and formatting is unavailable.'
              )}

              {context === 'explore' &&
                t(
                  'query-library.template-variables-warning.message-explore',
                  'You can only reuse this query in dashboards where the variables can be resolved.'
                )}
            </Alert>
          )}
          {datasourceApiLoading ? (
            <Box marginY={2}>
              <Skeleton height={48} />
            </Box>
          ) : hasTemplateVariables ? (
            <code className={styles.query}>{query.queryText || JSON.stringify(query.query, null, 2)}</code>
          ) : query.queryText ? (
            <code className={styles.query}>{query.queryText}</code>
          ) : (
            QueryEditor && <Box marginY={2}>{QueryEditor}</Box>
          )}
          {context === 'explore' && query.uid && !usingHistory && canEditQuery(query) && (
            <Button
              size="sm"
              variant="success"
              fill="text"
              disabled={isLocked || !canEditQuery(query) || hasTemplateVariables}
              onClick={() => {
                onOpenInExplore(query, onCloseDrawer);
                triggerAnalyticsEvent(QueryLibraryInteractions.editInExploreClicked, {
                  datasourceType: query.datasourceType,
                });
              }}
            >
              <Trans i18nKey="explore.query-library.explore">Edit in Explore</Trans>
            </Button>
          )}
        </Box>
        <Field label={t('query-library.query-details.datasource', 'Data source')}>
          <Input readOnly id={DATASOURCE_ID} value={query.datasourceName} />
        </Field>
        <Field label={t('query-library.query-details.description', 'Description')}>
          <Input id={DESCRIPTION_ID} readOnly={!editingQuery} {...register('description')} />
        </Field>
        {!usingHistory && (
          <Field label={t('query-library.query-details.tags', 'Tags')} htmlFor={TAGS_ID}>
            <Controller
              name={TAGS_ID}
              control={control}
              defaultValue={query.tags ?? []}
              render={({ field: { ref, value, onChange, ...field } }) => {
                return (
                  <TagsInput
                    {...field}
                    id={TAGS_ID}
                    disabled={!editingQuery}
                    onChange={(tags) => {
                      onChange(Array.from(new Set(tags)).sort());
                    }}
                    tags={value ? Array.from(value) : []}
                  />
                );
              }}
            />
          </Field>
        )}
        {!usingHistory && (
          <Field label={t('query-library.query-details.author', 'Author')}>
            <Input
              readOnly
              id={AUTHOR_ID}
              prefix={
                <Box marginRight={0.5}>
                  <Avatar
                    width={2}
                    height={2}
                    src={query.user?.avatarUrl || 'https://secure.gravatar.com/avatar'}
                    alt=""
                  />
                </Box>
              }
              value={query.user?.displayName}
            />
          </Field>
        )}
        <Field label={t('query-library.query-details.date-added', 'Date added')}>
          <Input readOnly id={DATE_ADDED_ID} value={formattedTime} />
        </Field>
        {!usingHistory && (
          <Field>
            <Checkbox
              label={t('query-library.query-details.make-query-visible', 'Share query with all users')}
              id={IS_VISIBLE_ID}
              disabled={!editingQuery}
              {...register('isVisible')}
            />
          </Field>
        )}
      </Box>
    </Stack>
  );
}

const QueryLibraryDetailsSkeleton: SkeletonComponent = ({ rootProps }) => {
  const skeletonStyles = useStyles2(getSkeletonStyles);
  return (
    <Box minWidth={0} {...rootProps}>
      <Stack direction="column" gap={2}>
        <Stack gap={1} alignItems="center" minWidth={0}>
          <Skeleton circle width={24} height={24} containerClassName={skeletonStyles.icon} />
          <Skeleton width={120} />
        </Stack>

        <Skeleton height={32} />

        <Box>
          <Skeleton width={60} />
          <Skeleton height={32} />
        </Box>

        <Box>
          <Skeleton width={60} />
          <Skeleton height={32} />
        </Box>

        <Box>
          <Skeleton width={60} />
          <Skeleton height={32} />
        </Box>
      </Stack>
    </Box>
  );
};

export const QueryLibraryDetails = attachSkeleton(QueryLibraryDetailsComponent, QueryLibraryDetailsSkeleton);

const getSkeletonStyles = () => ({
  icon: css({
    display: 'block',
    lineHeight: 1,
  }),
});

const getStyles = (theme: GrafanaTheme2) => ({
  query: css({
    backgroundColor: theme.colors.action.disabledBackground,
    borderRadius: theme.shape.radius.default,
    display: 'block',
    margin: theme.spacing(0, 0, 2, 0),
    overflowWrap: 'break-word',
    padding: theme.spacing(1),
    whiteSpace: 'pre-wrap',
  }),
  logo: css({
    width: '24px',
  }),
});
