import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, ConfirmModal, LinkButton, TextLink, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';

import { EnterpriseStoreState, RecordedQuery } from '../types';

import { EmptyRecordedQueryList } from './EmptyRecordedQueryList';
import { QueryCard } from './QueryCard';
import { deleteRecordedQuery, getRecordedQueriesAsync, updateRecordedQuery } from './state/actions';
import { getRecordedQueryItems } from './state/selectors';

export type Props = GrafanaRouteComponentProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: EnterpriseStoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'recordedQueries'),
    recordedQueries: getRecordedQueryItems(state.recordedQueries),
    isLoading: state.recordedQueries.isLoading,
  };
}

const mapDispatchToProps = {
  getRecordedQueriesAsync,
  updateRecordedQuery,
  deleteRecordedQuery,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export function recordedQueriesDeprecationNotice() {
  return (
    <Alert
      title={t('recorded-queries.recorded-queries-deprecation-notice.title-deprecation-notice', 'Deprecation Notice')}
      severity="warning"
    >
      <Trans i18nKey="recorded-queries.recorded-queries-deprecation-notice.description">
        Recorded queries are deprecated. Please use the new{' '}
        <TextLink
          href="https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/"
          external
        >
          Grafana Managed Recording Rules
        </TextLink>{' '}
        instead.
      </Trans>
    </Alert>
  );
}

export const RecordedQueriesConfigUnconnected = ({
  navModel,
  isLoading,
  recordedQueries,
  getRecordedQueriesAsync,
  updateRecordedQuery,
  deleteRecordedQuery: onDeleteRecordedQuery,
}: Props) => {
  useEffect(() => {
    getRecordedQueriesAsync();
  }, [getRecordedQueriesAsync]);
  const styles = useStyles2(getStyles);

  const [deleteRecordedQuery, setDeleteRecordedQuery] = useState<RecordedQuery>();

  const queriesToDisplay = recordedQueries.map((rq: RecordedQuery) => {
    const buttons = [
      <Button
        key={'toggle-recorded-query-active'}
        onClick={async () => {
          await updateRecordedQuery({ ...rq, active: !rq.active });
        }}
        variant={rq.active ? 'secondary' : 'primary'}
      >
        {rq.active
          ? t(
              'recorded-queries.recorded-queries-config-unconnected.queries-to-display.buttons.aria-label-pause-recorded-query',
              'Pause recording'
            )
          : t(
              'recorded-queries.recorded-queries-config-unconnected.queries-to-display.buttons.aria-label-resume-recorded-query',
              'Resume recording'
            )}
      </Button>,
      <Button
        key={'delete-recorded-query'}
        aria-label={t(
          'recorded-queries.recorded-queries-config-unconnected.queries-to-display.buttons.aria-label-delete-recorded-query',
          'Delete recorded query'
        )}
        onClick={() => setDeleteRecordedQuery(rq)}
        variant={'destructive'}
      >
        <Trans i18nKey="recorded-queries.recorded-queries-config-unconnected.queries-to-display.buttons.delete">
          Delete
        </Trans>
      </Button>,
    ];

    return <QueryCard key={rq.id} recordedQuery={rq} buttons={buttons} />;
  });

  const contents = () => {
    if (isLoading) {
      return <PageLoader />;
    }
    return queriesToDisplay.length === 0 ? <EmptyRecordedQueryList /> : queriesToDisplay;
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        {recordedQueriesDeprecationNotice()}
        <div className={styles.header}>
          <LinkButton icon={'cog'} href={'/recorded-queries/write-target'}>
            <Trans i18nKey="recorded-queries.recorded-queries-config-unconnected.edit-remote-write-target">
              Edit remote write target
            </Trans>
          </LinkButton>
        </div>
        {contents()}
        {deleteRecordedQuery && (
          <ConfirmModal
            isOpen
            icon="trash-alt"
            title={t('recorded-queries.recorded-queries-config-unconnected.title-delete', 'Delete')}
            body={
              <div>
                <Trans i18nKey="recorded-queries.recorded-queries-config-unconnected.body-delete">
                  Are you sure you want to delete &apos;{{ name: deleteRecordedQuery.name }}&apos;?
                </Trans>
              </div>
            }
            confirmText={t('recorded-queries.recorded-queries-config-unconnected.confirm-text-delete', 'Delete')}
            onDismiss={() => setDeleteRecordedQuery(undefined)}
            onConfirm={async () => {
              await onDeleteRecordedQuery(deleteRecordedQuery);
              setDeleteRecordedQuery(undefined);
            }}
          />
        )}
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      display: 'flex',
      justifyContent: 'flex-end',
      marginBottom: theme.spacing(1),
    }),
    title: css({
      marginBottom: 0,
      width: '100%',
    }),
  };
};

export const RecordedQueriesConfig = connector(RecordedQueriesConfigUnconnected);
export default RecordedQueriesConfig;
