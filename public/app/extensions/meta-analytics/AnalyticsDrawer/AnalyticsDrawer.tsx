import { PureComponent } from 'react';
import { connect } from 'react-redux';

import { dateTime, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Drawer, Tab, TabContent, TabsBar, Themeable2, withTheme2 } from '@grafana/ui';
import { UpgradeBox } from 'app/core/components/Upgrade/UpgradeBox';
import { highlightTrial } from 'app/features/admin/utils';
import { isPublicDashboardsEnabled } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { AnalyticsTab, EnterpriseStoreState } from '../../types';
import {
  DAILY_SUMMARY_DATE_FORMAT,
  DashboardDailySummaryDTO,
  getDashboardDailySummaries,
  getPublicDashboardDailySummaries,
  getUserViews,
  UserViewDTO,
} from '../api';
import { setDrawerOpen, setDrawerTab } from '../state/reducers';
import { getInsightsStyles, InsightsStyles } from '../styles';

import AnalyticsPublicDashboardsTab from './AnalyticsPublicDashboardsTab';
import AnalyticsStatsTab from './AnalyticsStatsTab';
import AnalyticsUsersTab from './AnalyticsUsersTab';

interface Props extends Themeable2 {
  dashboard: DashboardModel;
  drawerTab: AnalyticsTab;
  setDrawerOpen: typeof setDrawerOpen;
  setDrawerTab: typeof setDrawerTab;
}

interface State {
  dailySummaries: DashboardDailySummaryDTO[];
  publicDailySummaries: DashboardDailySummaryDTO[];
  userViews: UserViewDTO[];
}

const USER_LIMIT = 30;

class AnalyticsDrawer extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      dailySummaries: [],
      publicDailySummaries: [],
      userViews: [],
    };
  }

  async componentDidMount(): Promise<void> {
    const { dashboard } = this.props;

    const days = [];
    for (let i = 0; i < 30; i++) {
      days.push(dateTime(Date.now()).subtract(i, 'days').format(DAILY_SUMMARY_DATE_FORMAT));
    }
    if (dashboard?.id && dashboard.meta.url) {
      const dailySummaries = await getDashboardDailySummaries(dashboard.uid, days);
      const userViews = await getUserViews(dashboard.uid, USER_LIMIT);

      let publicDailySummaries: DashboardDailySummaryDTO[] = [];
      if (isPublicDashboardsEnabled()) {
        publicDailySummaries = await getPublicDashboardDailySummaries(dashboard.uid, days);
      }

      this.setState({ dailySummaries, userViews, publicDailySummaries });
    }
  }

  onSelectTab = (item: SelectableValue<AnalyticsTab>) => {
    this.props.setDrawerTab(item.value || AnalyticsTab.Stats);
  };

  renderHeader(styles: InsightsStyles) {
    const tabs = [
      { label: t('meta-analytics.analytics-drawer.stats-tab-label', 'Stats'), value: AnalyticsTab.Stats },
      {
        label: t('meta-analytics.analytics-drawer.users-activity-tab-label', 'Users and activity'),
        value: AnalyticsTab.Users,
      },
    ];

    if (isPublicDashboardsEnabled()) {
      tabs.push({
        label: config.featureToggles.newDashboardSharingComponent
          ? t('meta-analytics.analytics-drawer.shared-dashboards-tab-label', 'Shared dashboards')
          : t('meta-analytics.analytics-drawer.public-dashboards-tab-label', 'Public dashboards'),
        value: AnalyticsTab.PublicDashboards,
      });
    }

    return (
      <TabsBar className={styles.tabsBar}>
        {tabs.map((t, index) => (
          <Tab
            key={`${t.value}-${index}`}
            label={t.label}
            active={t.value === this.props.drawerTab}
            onChangeTab={() => this.onSelectTab(t)}
          />
        ))}
      </TabsBar>
    );
  }

  render() {
    const { dailySummaries, publicDailySummaries, userViews } = this.state;
    const { dashboard, drawerTab, setDrawerOpen, theme } = this.props;
    const styles = getInsightsStyles(theme);
    const title = t('meta-analytics.analytics-drawer.title-dashboard-insights', '{{dashboardTitle}} - analytics', {
      dashboardTitle: dashboard.title,
    });
    return (
      <Drawer
        scrollableContent
        title={title}
        size="md"
        onClose={() => setDrawerOpen(false)}
        subtitle={this.renderHeader(styles)}
        expandable
      >
        <TabContent className={styles.tabContent}>
          {highlightTrial() && (
            <UpgradeBox
              featureId={'dashboard-insights'}
              eventVariant={'trial'}
              featureName={'dashboard usage insights'}
              text={t(
                'meta-analytics.analytics-drawer.text-access-usage-insights-during-trial-grafana',
                'Get full access to usage insights for free during your trial of Grafana Pro.'
              )}
            />
          )}
          {drawerTab === AnalyticsTab.Stats && (
            <AnalyticsStatsTab dashboard={dashboard} dailySummaries={dailySummaries} />
          )}
          {drawerTab === AnalyticsTab.Users && (
            <AnalyticsUsersTab dashboard={dashboard} dailySummaries={dailySummaries} userViews={userViews} />
          )}
          {isPublicDashboardsEnabled() && drawerTab === AnalyticsTab.PublicDashboards && (
            <AnalyticsPublicDashboardsTab dashboard={dashboard} dailySummaries={publicDailySummaries} />
          )}
        </TabContent>
      </Drawer>
    );
  }
}

function mapStateToProps(state: EnterpriseStoreState) {
  return {
    drawerTab: state.metaAnalytics.drawerTab,
  };
}

const mapActionsToProps = {
  setDrawerOpen,
  setDrawerTab,
};

export default withTheme2(connect(mapStateToProps, mapActionsToProps)(AnalyticsDrawer));
