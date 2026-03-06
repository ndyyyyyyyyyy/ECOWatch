import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useStyles2, LinkButton } from '@grafana/ui';
import { UpgradeBox } from 'app/core/components/Upgrade/UpgradeBox';

export function HighlightTrialReport() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.highlight}>
      <UpgradeBox
        featureId={'reporting-tab'}
        eventVariant={'trial'}
        featureName={'reporting'}
        text={t(
          'reports.highlight-trial-report.text-create-unlimited-reports-during-trial-grafana',
          'Create unlimited reports during your trial of Grafana Pro.'
        )}
      />
      <h3>
        <Trans i18nKey="reports.highlight-trial-report.get-started-with-reporting">Get started with reporting</Trans>
      </h3>
      <h6>
        <Trans i18nKey="reports.highlight-trial-report.get-started-with-reporting-text">
          Reporting allows you to automatically generate PDFs from any of your dashboards and have Grafana email them to
          interested parties on a schedule.
        </Trans>
      </h6>
      <LinkButton fill="text" href={'https://grafana.com/docs/grafana/latest/enterprise/reporting'}>
        <Trans i18nKey="reports.highlight-trial-report.learn-more">Learn more</Trans>
      </LinkButton>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    highlight: css({
      marginBottom: theme.spacing(3),
      h6: {
        fontWeight: theme.typography.fontWeightLight,
      },
    }),
  };
};
