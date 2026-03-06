import { t } from '@grafana/i18n';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { contextSrv } from 'app/core/core';

import { AccessControlAction } from '../types';

import { Props } from './DataSourceCache';

export const CacheCTA = (props: Props) => {
  const { enableDataSourceCache, dataSource, pageId } = props;
  const canWriteCache =
    contextSrv.hasPermissionInMetadata(AccessControlAction.DataSourcesCachingWrite, dataSource) &&
    dataSource.readOnly === false;

  return dataSource.jsonData?.disableGrafanaCache ? (
    <EmptyListCTA
      title={t(
        'caching.cache-cta.title-caching-cannot-enabled-source',
        'Caching cannot be enabled for this data source.'
      )}
      buttonTitle={t('caching.cache-cta.enable-button-title', 'Enable')}
      buttonIcon="database"
      proTip={t(
        'caching.cache-cta.protip-caching-cannot-enabled-source',
        "This data source's configuration does not permit caching to be enabled."
      )}
      buttonDisabled={true}
    />
  ) : (
    <EmptyListCTA
      title={t('caching.cache-cta.title-caching-not-enabled', 'Caching is not enabled for this data source.')}
      buttonTitle={t('caching.cache-cta.enable-button-tittle', 'Enable')}
      buttonIcon="database"
      onClick={() => {
        enableDataSourceCache(pageId);
      }}
      proTip={t(
        'caching.cache-cta.protip-caching-not-enabled',
        'Enabling caching can reduce the amount of redundant requests sent to the data source.'
      )}
      proTipLink="https://grafana.com/docs/grafana/latest/enterprise/query-caching/"
      proTipLinkTitle={t('caching.cache-cta.protip-link-caching-not-enabled', 'Learn more')}
      buttonDisabled={!canWriteCache}
    />
  );
};
