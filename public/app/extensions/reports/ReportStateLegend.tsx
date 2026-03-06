import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { ReportState } from '../types';

export function ReportStateLegend({ reportState }: { reportState?: ReportState }) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  if (!reportState) {
    return 'NEW';
  }

  const color = reportStateColorsMap(theme).get(reportState);

  return (
    <span
      className={cx(
        styles.scheduleStatus,
        css({
          color: color,
        })
      )}
    >
      {reportState.toUpperCase()}
    </span>
  );
}

const reportStateColorsMap = (theme: GrafanaTheme2) => {
  return new Map([
    [ReportState.Scheduled, theme.colors.success.text],
    [ReportState.Expired, theme.colors.warning.text],
    [ReportState.Draft, theme.colors.text.primary],
    [ReportState.Never, theme.colors.text.primary],
    [ReportState.Paused, theme.colors.text.disabled],
  ]);
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    scheduleStatus: css({
      textTransform: 'uppercase',
    }),
  };
};
