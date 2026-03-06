import { connect } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  FieldType,
  DataFrame,
  DateTime,
  dateTime,
  FieldConfig,
  GrafanaTheme2,
  applyFieldOverrides,
  FieldConfigSource,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Table, Themeable2, withTheme2, UserIcon } from '@grafana/ui';
import { TableFieldOptions, TableCellDisplayMode } from '@grafana/ui/internal';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { getDashboardUsersInfo, DashboardDailySummaryDTO, DashboardUsersInfoDTO, UserViewDTO } from '../api';
import { setDrawerOpen } from '../state/reducers';
import { getInsightsStyles, InsightsStyles } from '../styles';

import { AnalyticsTab } from './AnalyticsTab';

export interface Props extends Themeable2 {
  dashboard: DashboardModel;
  dailySummaries: DashboardDailySummaryDTO[];
  userViews: UserViewDTO[];
  setDrawerOpen: typeof setDrawerOpen;
}

interface State {
  dashboardUsersInfo: DashboardUsersInfoDTO | null;
}

export class AnalyticsUsersTab extends AnalyticsTab<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      dashboardUsersInfo: null,
    };
  }

  async componentDidMount(): Promise<void> {
    const { dashboard } = this.props;

    try {
      const dashboardUsersInfo = await getDashboardUsersInfo(dashboard.uid);
      this.setState({ dashboardUsersInfo });
    } catch (err) {
      console.log('Error getting dashboard users info', err);
    }
  }

  formatDate(date: DateTime): string {
    const diffDays = date.diff(dateTime().startOf('day'), 'days', true);

    if (diffDays < -6) {
      return date.format('YYYY-MM-DD');
    } else if (diffDays < -1) {
      return date.locale('en').format('dddd');
    } else if (diffDays < 0) {
      return t('meta-analytics.analytics-users-tab.format-date-yesterday', 'Yesterday');
    } else {
      const diffMinutes = date.diff(dateTime(), 'minutes', true);

      if (diffMinutes < -60) {
        return t('meta-analytics.analytics-users-tab.format-date-today', 'Today');
      } else if (diffMinutes < -15) {
        return t('meta-analytics.analytics-users-tab.format-date-last-hour', 'Last hour');
      } else {
        return t('meta-analytics.analytics-users-tab.format-date-currently-viewing', 'Currently viewing');
      }
    }
  }

  onOpenVersionHistory = () => {
    const { setDrawerOpen } = this.props;
    setDrawerOpen(false);
    locationService.partial({ editview: 'versions' });
  };

  renderUserBox(title: string, userView: UserViewDTO, styles: InsightsStyles) {
    return (
      <div
        className={styles.userBox}
        aria-label={t('meta-analytics.analytics-users-tab.aria-label-user-information-box', 'User information box')}
      >
        <h6 aria-label={t('meta-analytics.analytics-users-tab.aria-label-user-box-title', 'User box title')}>
          {title}
        </h6>
        <UserIcon userView={userView} showTooltip={false} />
        <div className={styles.userName}>{userView.user.name}</div>
        <div>{dateTime(userView.lastActiveAt).format('YYYY-MM-DD')}</div>
      </div>
    );
  }

  renderViewsChart() {
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
                title: t('meta-analytics.analytics-users-tab.views-last-month-title', 'Views last 30 days'),
                fields: [
                  {
                    name: 'views',
                    type: FieldType.number,
                  },
                ],
                width,
                timeRange,
                showBars: true,
                showLines: false,
              })}
            </main>
          );
        }}
      </AutoSizer>
    );
  }

  convertUserViewsToDataFrame(styles: InsightsStyles, theme: GrafanaTheme2): DataFrame | null {
    const { userViews } = this.props;
    if (userViews && userViews.length > 0) {
      const time: string[] = [];
      const users: string[] = [];
      const avatars: JSX.Element[] = [];

      userViews.forEach((userView) => {
        time.push(this.formatDate(dateTime(userView.lastActiveAt)));
        users.push(userView.user.name);
        avatars.push(<UserIcon className={styles.userIcon} userView={userView} showTooltip={false} />);
      });

      const avatarFieldConfig: FieldConfig<TableFieldOptions> = {
        displayName: ' ',
        filterable: false,
        custom: {
          width: 50,
          align: 'center',
          minWidth: 50,
          cellOptions: {
            type: TableCellDisplayMode.ColorText,
          },
          inspect: false,
        },
      };
      const data = [
        {
          fields: [
            { name: ' ', type: FieldType.other, config: avatarFieldConfig, values: avatars },
            {
              name: t('meta-analytics.analytics-users-tab.user-views-data-frame-user-field', 'User'),
              type: FieldType.string,
              config: {},
              values: users,
            },
            {
              name: t('meta-analytics.analytics-users-tab.user-views-data-frame-when-field', 'When'),
              type: FieldType.string,
              config: {},
              values: time,
            },
          ],
          length: userViews.length,
        },
      ];
      const processedData = applyFieldOverrides({
        data,
        theme,
        replaceVariables: (value: string) => value,
        fieldConfig: {} as unknown as FieldConfigSource,
      });
      return processedData.length > 0 ? processedData[0] : null;
    } else {
      return null;
    }
  }

  render() {
    const { dailySummaries, dashboard, theme, userViews } = this.props;
    const { dashboardUsersInfo } = this.state;
    const styles = getInsightsStyles(theme);
    const userViewsDataFrame = this.convertUserViewsToDataFrame(styles, theme);
    return (
      <div>
        {dailySummaries && dailySummaries.length > 0 && this.renderViewsChart()}
        <div className={styles.userBoxesContainer}>
          {dashboardUsersInfo?.creator &&
            this.renderUserBox(
              t('meta-analytics.analytics-users-tab.created-user-box', 'Created'),
              dashboardUsersInfo.creator,
              styles
            )}
          {dashboardUsersInfo?.lastEditor &&
            this.renderUserBox(
              t('meta-analytics.analytics-users-tab.last-edited-user-box', 'Last edited'),
              dashboardUsersInfo.lastEditor,
              styles
            )}
          {userViews?.length > 0 &&
            this.renderUserBox(
              t('meta-analytics.analytics-users-tab.last-viewed-user-box', 'Last viewed'),
              userViews[0],
              styles
            )}
        </div>
        {userViews?.length > 0 && (
          <div className={styles.tableContainer}>
            <div className={styles.tableHeader}>
              <h4>
                <Trans i18nKey="meta-analytics.analytics-users-tab.last-dashboard-viewers">
                  Last 30 dashboard viewers
                </Trans>
              </h4>
              {dashboard.meta.showSettings && (
                <Button
                  icon="history"
                  variant="secondary"
                  onClick={this.onOpenVersionHistory}
                  aria-label={t(
                    'meta-analytics.analytics-users-tab.aria-label-version-history-button',
                    'Version history button'
                  )}
                >
                  <Trans i18nKey="meta-analytics.analytics-users-tab.dashboard-version-history">
                    Dashboard version history
                  </Trans>
                </Button>
              )}
            </div>
            <AutoSizer disableHeight>
              {({ width }) => {
                if (width === 0) {
                  return null;
                }

                const fullTableHeight = 35 * (userViewsDataFrame!.length + 1);
                return (
                  <main style={{ width }}>
                    <Table
                      data={userViewsDataFrame!}
                      height={fullTableHeight}
                      width={width}
                      aria-label={t(
                        'meta-analytics.analytics-users-tab.aria-label-recent-users-table',
                        'Recent users table'
                      )}
                    />
                  </main>
                );
              }}
            </AutoSizer>
          </div>
        )}
      </div>
    );
  }
}

const mapDispatchToProps = {
  setDrawerOpen,
};

export default withTheme2(connect(null, mapDispatchToProps)(AnalyticsUsersTab));
