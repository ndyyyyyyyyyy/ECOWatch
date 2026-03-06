import AutoSizer from 'react-virtualized-auto-sizer';

import { FieldType } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Themeable2, withTheme2 } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { DashboardDailySummaryDTO } from '../api';

import { AnalyticsTab } from './AnalyticsTab';

export interface Props extends Themeable2 {
  dashboard: DashboardModel;
  dailySummaries: DashboardDailySummaryDTO[];
}

class AnalyticsStatsTab extends AnalyticsTab<Props> {
  render() {
    const { dailySummaries, theme } = this.props;

    if (dailySummaries && dailySummaries.length > 0) {
      const timeRange = this.buildTimeRange();

      return (
        <AutoSizer disableHeight>
          {({ width }) => {
            if (width === 0) {
              return null;
            }

            return (
              <main style={{ width }}>
                {this.renderChart({
                  title: t('meta-analytics.analytics-stats-tab.daily-query-count-title', 'Daily query count'),
                  fields: [
                    {
                      name: 'queries',
                      type: FieldType.number,
                    },
                    {
                      name: 'cachedQueries',
                      type: FieldType.number,
                      label: t(
                        'meta-analytics.analytics-stats-tab.daily-query-count-cached-queries-label',
                        'cached queries'
                      ),
                    },
                  ],
                  width,
                  timeRange,
                  showBars: false,
                  showLines: true,
                })}
                {this.renderChart({
                  title: t('meta-analytics.analytics-stats-tab.errors-last-month-title', 'Errors last 30 days'),
                  fields: [
                    {
                      name: 'errors',
                      type: FieldType.number,
                      color: theme.colors.error.border,
                    },
                  ],
                  width,
                  timeRange,
                  showBars: false,
                  showLines: true,
                })}
              </main>
            );
          }}
        </AutoSizer>
      );
    }

    return (
      <span>
        <Trans i18nKey="meta-analytics.analytics-stats-tab.no-data">No data.</Trans>
      </span>
    );
  }
}

export default withTheme2(AnalyticsStatsTab);
