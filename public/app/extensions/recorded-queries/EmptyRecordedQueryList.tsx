import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { CallToActionCard, Icon, useStyles2 } from '@grafana/ui';

export const EmptyRecordedQueryList = (): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <CallToActionCard
      className={styles.cta}
      message={t('recorded-queries.empty-recorded-query-list.message', 'No recorded queries defined')}
      footer={
        <span key="proTipFooter">
          <Icon name="rocket" />
          <Trans i18nKey="recorded-queries.empty-recorded-query-list.pro-tip">
            ProTip: {'You can record queries from the query editor.'}
          </Trans>
        </span>
      }
      callToActionElement={<></>}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cta: css({
      textAlign: 'center',
    }),
  };
};
