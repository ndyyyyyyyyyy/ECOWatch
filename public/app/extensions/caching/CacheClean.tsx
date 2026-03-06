import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, ConfirmModal } from '@grafana/ui';
import { contextSrv } from 'app/core/core';

import { AccessControlAction } from '../types';

import { Props } from './DataSourceCache';

export const CacheClean = (props: Props) => {
  const { cleanCache, dataSource, pageId } = props;
  const [showCleanModal, setShowCleanModal] = useState(false);

  const showConfirmCleanModal = (show: boolean) => () => {
    setShowCleanModal(show);
  };

  const handleCleanCache = () => {
    cleanCache(pageId);
    setShowCleanModal(false);
  };

  const canWriteCache =
    contextSrv.hasPermissionInMetadata(AccessControlAction.DataSourcesCachingWrite, dataSource) &&
    dataSource.readOnly === false;

  return (
    <div>
      <Button variant="destructive" onClick={showConfirmCleanModal(true)} disabled={!canWriteCache}>
        <Trans i18nKey="caching.cache-clean.clear-cache">Clear cache</Trans>
      </Button>
      <ConfirmModal
        isOpen={showCleanModal}
        title={t('caching.cache-clean.title-clear-cache', 'Clear cache')}
        body={t(
          'caching.cache-clean.body-clear-cache',
          'Warning: This action impacts all cache-enabled data sources. If you are using Memcached, the system clears all data from the Memcached instance. Do you want to continue?'
        )}
        confirmText={t('caching.cache-clean.confirm-text-clear-cache', 'Clear cache')}
        onConfirm={handleCleanCache}
        onDismiss={showConfirmCleanModal(false)}
      />
    </div>
  );
};
