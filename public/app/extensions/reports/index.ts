import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { featureEnabled, locationService, reportInteraction } from '@grafana/runtime';
import { ProBadge } from 'app/core/components/Upgrade/ProBadge';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { highlightTrial } from 'app/features/admin/utils';
import { addDashboardShareTab } from 'app/features/dashboard/components/ShareModal/ShareModal';
import { ShareModalTabModel } from 'app/features/dashboard/components/ShareModal/types';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import {
  addDashboardExportDrawerItem,
  ExportDrawerMenuItem,
} from 'app/features/dashboard-scene/sharing/ExportButton/ExportMenu';
import {
  addDashboardShareDrawerItem,
  ShareDrawerMenuItem,
} from 'app/features/dashboard-scene/sharing/ShareButton/ShareMenu';
import { addDashboardShareView } from 'app/features/dashboard-scene/sharing/ShareDrawer/ShareDrawer';
import { addDashboardShareTab as addSceneDashboardShareTab } from 'app/features/dashboard-scene/sharing/ShareModal';

import { AccessControlAction, StepKey } from '../types';
import { buildExperimentID } from '../utils/featureHighlights';

import { CreateReportTab } from './CreateReportTab';
import Confirm from './ReportForm/Confirm';
import FormatReport from './ReportForm/FormatReport';
import Schedule from './ReportForm/Schedule';
import SelectDashboard from './ReportForm/SelectDashboard';
import Share from './ReportForm/Share';
import { SharePDF } from './SharePDF';
import { CreateReportTab as CreateReportTabScene } from './dashboard-scene/CreateReportTab';
import { SharePDFTab } from './dashboard-scene/SharePDFTab';
import { ShareReport } from './dashboard-scene/ShareReport';
import { selectors } from './e2e-selectors/selectors';
import { getNewReportUrl } from './utils/url';

const highlightsEnabled = config.featureToggles.featureHighlights;
const shareButtonSelector = selectors.components.NewShareButton.Menu;

const sharePDFTab: ShareModalTabModel = {
  label: 'PDF',
  value: shareDashboardType.pdf,
  component: SharePDF,
};

const createReportTab: ShareModalTabModel = {
  label: 'Report',
  value: shareDashboardType.report,
  tabSuffix:
    (highlightsEnabled && !featureEnabled('reports.creation')) || highlightTrial()
      ? () => ProBadge({ experimentId: buildExperimentID('reporting-tab-badge') })
      : undefined,
  component: CreateReportTab,
};

export function initReporting() {
  if (!config.reporting?.enabled) {
    return;
  }

  addPDFFeature();
  addReportFeature();
}

const addPDFFeature = () => {
  if (featureEnabled('reports.creation')) {
    // OLD MODAL LOGIC
    addDashboardShareTab(sharePDFTab); // without scenes
    addSceneDashboardShareTab(SharePDFTab); // with scenes

    // NEW DRAWER LOGIC
    const onExportAsPdfClick = () => {
      locationService.partial({ shareView: shareDashboardType.pdf });
    };

    const exportAsPdfMenuItem: ExportDrawerMenuItem = {
      shareId: shareDashboardType.pdf,
      testId: 'data-testid new export button export as pdf',
      icon: 'file-alt',
      label: t('share-dashboard.menu.export-pdf-title', 'Export as PDF'),
      renderCondition: true,
      onClick: onExportAsPdfClick,
    };

    // This is the latest implementation with scenes enabled
    addDashboardExportDrawerItem(exportAsPdfMenuItem); // button to open the drawer
    addDashboardShareView({ id: shareDashboardType.pdf, shareOption: SharePDFTab }); // drawer child
  }
};

export const addReportFeature = () => {
  // OLD MODAL LOGIC
  if (featureEnabled('reports.creation') || highlightsEnabled) {
    addDashboardShareTab(createReportTab); // without scenes
    addSceneDashboardShareTab(CreateReportTabScene); // with scenes
  }

  // NEW DRAWER LOGIC
  const onReportClick = (dashboard: DashboardScene) => {
    // If the new share report drawer is enabled we only display it. It contains the logic to create a new report
    // or display information when reporting is disabled
    if (config.featureToggles.newShareReportDrawer) {
      locationService.partial({ shareView: shareDashboardType.report });
      return;
    }

    const isReportsCreationEnabled = featureEnabled('reports.creation');

    if (isReportsCreationEnabled && !highlightTrial()) {
      reportInteraction('dashboards_sharing_report_create_clicked');
      const reportUrl = locationUtil.stripBaseFromUrl(`${config.appUrl}${getNewReportUrl(dashboard)}`);
      locationService.push(reportUrl);
    } else {
      locationService.partial({ shareView: shareDashboardType.report });
    }
  };

  const createReportMenuItem: ShareDrawerMenuItem = {
    shareId: shareDashboardType.report,
    testId: shareButtonSelector.scheduleReport,
    icon: 'clock-nine',
    label: t('share-dashboard.menu.schedule-report-title', 'Schedule report'),
    renderCondition: true,
    onClick: onReportClick,
  };

  // this is because the drawer contains the report list and the report form that
  // is used to read the report with all the inputs disabled
  // if the user has permission to read reports, we can display the drawer
  if (
    config.featureToggles.newShareReportDrawer &&
    featureEnabled('reports') &&
    contextSrv.hasPermission(AccessControlAction.ReportingRead)
  ) {
    addDashboardShareDrawerItem(createReportMenuItem); // button to open the drawer
    addDashboardShareView({ id: shareDashboardType.report, shareOption: ShareReport }); // drawer child
    return;
  }

  // otherwise, we only display the drawer when the user has permission to create reports or when the feature highlights are enabled
  if (
    (featureEnabled('reports.creation') && contextSrv.hasPermission(AccessControlAction.ReportingCreate)) ||
    highlightsEnabled
  ) {
    addDashboardShareDrawerItem(createReportMenuItem);

    if (config.featureToggles.newShareReportDrawer) {
      addDashboardShareView({ id: shareDashboardType.report, shareOption: ShareReport });
    } else {
      addDashboardShareView({ id: shareDashboardType.report, shareOption: CreateReportTabScene });
    }
  }
};

export const reportSteps = [
  { id: StepKey.SelectDashboard, name: 'Select dashboard', component: SelectDashboard },
  { id: StepKey.FormatReport, name: 'Format report', component: FormatReport },
  { id: StepKey.Schedule, name: 'Schedule', component: Schedule },
  { id: StepKey.Share, name: 'Share', component: Share },
  { id: StepKey.Confirm, name: 'Confirm', component: Confirm },
];
