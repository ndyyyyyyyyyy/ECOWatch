import saveAs from 'file-saver';
import { lastValueFrom } from 'rxjs';

import { AppEvents, urlUtil } from '@grafana/data';
import { getAppEvents, getBackendSrv } from '@grafana/runtime';

import { SelectDashboardScene } from '../ReportFormV2/sections/SelectDashboards/SelectDashboardScene';
import { API_RENDER_CSVS } from '../constants';
import { dashboardsInvalidV2 } from '../utils/dashboards';
import { getReportDashboardsAsUrlParamV2 } from '../utils/url';

export const downloadCSV = async (reportTitle: string, sceneDashboards: SelectDashboardScene[]): Promise<void> => {
  if (dashboardsInvalidV2(sceneDashboards)) {
    getAppEvents().publish({
      type: AppEvents.alertError.name,
      payload: ['Invalid dashboards'],
    });
    return;
  }

  const params = {
    title: reportTitle,
    dashboards: getReportDashboardsAsUrlParamV2(sceneDashboards),
  };

  const downloadCSVUrl = urlUtil.appendQueryToUrl(API_RENDER_CSVS, urlUtil.toUrlParams(params));

  try {
    const response = await lastValueFrom(
      getBackendSrv().fetch<BlobPart>({ url: downloadCSVUrl, method: 'GET', responseType: 'blob' })
    );
    if (response.status === 204) {
      getAppEvents().publish({
        type: AppEvents.alertWarning.name,
        payload: ['The report does not contain any dashboard with a table panel'],
      });
      return;
    }
    const blob = new Blob([response.data], { type: 'application/zip' });
    saveAs(blob, `${reportTitle || 'report-csv'}.zip`);
    getAppEvents().publish({
      type: AppEvents.alertSuccess.name,
      payload: ['CSV downloaded'],
    });
  } catch (error) {
    getAppEvents().publish({
      type: AppEvents.alertError.name,
      payload: ['There was an error downloading the CSV'],
    });
  }
};
