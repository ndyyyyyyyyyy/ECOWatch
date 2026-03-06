import { MouseEvent } from 'react';
import { useFormContext } from 'react-hook-form';
import { useAsyncFn } from 'react-use';

import { AppEvents, urlUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { Button, Dropdown, Menu, MenuItem } from '@grafana/ui';
import { ReportBaseV2 } from 'app/extensions/types';

import { downloadCSV } from '../../api/csv';
import { API_RENDER_PDFS, SETTINGS_URL } from '../../constants';
import { useReportFormContext } from '../../dashboard-scene/ReportRenderingProvider';
import { selectors } from '../../e2e-selectors/selectors';
import { dashboardsInvalidV2 } from '../../utils/dashboards';
import { getReportDashboardsAsUrlParamV2 } from '../../utils/url';
import { ReportingInteractions } from '../reportingInteractions';
import { SelectDashboardScene } from '../sections/SelectDashboards/SelectDashboardScene';

export default function ActionsMenu({ sceneDashboards }: { sceneDashboards: SelectDashboardScene[] }) {
  const { watch } = useFormContext<ReportBaseV2>();

  const reportFormContext = useReportFormContext();

  const reportName = watch('title');

  const [state, handleDownloadCSV] = useAsyncFn(
    async (e: MouseEvent) => {
      ReportingInteractions.downloadCSVClicked(reportFormContext.renderingContext);
      e.stopPropagation();
      await downloadCSV(reportName, sceneDashboards);
    },
    [reportName, sceneDashboards]
  );

  const dashboardsInvalid = dashboardsInvalidV2(sceneDashboards);

  const redirectToPDFPreview = (e: MouseEvent) => {
    ReportingInteractions.previewPDFClicked(reportFormContext.renderingContext);

    if (dashboardsInvalid) {
      e.stopPropagation();
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: ['Invalid dashboards'],
      });
    }

    const params = {
      title: reportName,
      scaleFactor: watch('pdfOptions.scaleFactor') || 100,
      orientation: watch('pdfOptions.orientation') || 'landscape',
      layout: watch('pdfOptions.layout') || 'grid',
      pdfShowTemplateVariables: Boolean(watch('pdfOptions.dashboardPDF.showTemplateVariables')).toString(),
      pdfCombineOneFile: Boolean(watch('pdfOptions.dashboardPDF.combineOneFile')).toString(),
      includeTables: Boolean(watch('pdfOptions.dashboardPDF.addPDFTablesAppendix')).toString(),
      dashboards: getReportDashboardsAsUrlParamV2(sceneDashboards),
    };

    const url = urlUtil.appendQueryToUrl(API_RENDER_PDFS, urlUtil.toUrlParams(params));
    window.open(url, '_blank');
  };

  const menu = (
    <Menu>
      <MenuItem
        label={
          state.loading
            ? t('share-report.actions.downloading-label', 'Downloading...')
            : t('share-report.actions.download-csv-label', 'Download CSV')
        }
        icon={state.loading ? 'spinner' : 'file-download'}
        onClick={handleDownloadCSV}
        disabled={state.loading}
        testId={selectors.components.ReportFormDrawer.ActionsMenu.downloadCsv}
      />
      <MenuItem
        label={t('share-report.actions.preview-pdf-label', 'Preview PDF')}
        icon="external-link-alt"
        onClick={redirectToPDFPreview}
        testId={selectors.components.ReportFormDrawer.ActionsMenu.previewPdf}
      />
      <Menu.Divider />
      <MenuItem
        label={t('share-report.actions.report-settings-label', 'Report settings')}
        icon="external-link-alt"
        url={SETTINGS_URL}
        target="_blank"
        testId={selectors.components.ReportFormDrawer.ActionsMenu.reportSettings}
        onClick={() => ReportingInteractions.settingsClicked(reportFormContext.renderingContext)}
      />
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-end">
      <Button
        aria-label={t('share-report.actions.aria-label-open-menu', 'Open actions menu')}
        variant="secondary"
        fill="outline"
        icon="ellipsis-v"
        data-testid={selectors.components.ReportFormDrawer.actionsMenuButton}
      />
    </Dropdown>
  );
}
