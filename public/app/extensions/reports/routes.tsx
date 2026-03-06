import { lazy } from 'react';
import { Navigate, useParams } from 'react-router-dom-v5-compat';

import { config, featureEnabled } from '@grafana/runtime';
import { DashboardRoutes } from 'app/types/dashboard';

import { REPORT_BASE_URL, NEW_REPORT_URL } from './constants';

function RedirectToReportPage() {
  const { id } = useParams();
  return <Navigate replace to={`${REPORT_BASE_URL}?reportId=${id}`} />;
}

export function getReportingRoutes() {
  const routes = [];
  if (config.reporting?.enabled) {
    if (featureEnabled('reports')) {
      routes.push(
        {
          path: REPORT_BASE_URL,
          component: lazy(() => import(/* webpackChunkName: "ReportsListPage" */ './ReportsListPage')),
        },
        {
          path: `${REPORT_BASE_URL}/settings`,
          component: () => <Navigate replace to={`${REPORT_BASE_URL}?reportView=settings`} />,
        },
        {
          path: '/d-csv/:uid',
          pageClass: 'dashboard-solo',
          routeName: DashboardRoutes.Normal,
          component: lazy(() => import(/* webpackChunkName: "CSVExportPage" */ './CSVExportPage')),
        }
      );

      if (config.featureToggles.newPDFRendering) {
        routes.push({
          path: '/d-report/:uid/:slug?',
          component: lazy(
            () => import(/* webpackChunkName: "DashboardReportPage" */ './dashboard/DashboardReportPage')
          ),
        });
      }
    } else if (config.featureToggles.featureHighlights) {
      routes.push({
        path: REPORT_BASE_URL,
        component: lazy(() => import(/* webpackChunkName: "ReportsUpgradePage" */ './ReportsUpgradePage')),
      });
    }

    if (featureEnabled('reports.creation')) {
      routes.push({
        path: `${REPORT_BASE_URL}/new`,
        component: () => (
          <Navigate
            replace
            to={config.featureToggles.newShareReportDrawer ? `${REPORT_BASE_URL}?reportView=new` : `/${NEW_REPORT_URL}`}
          />
        ),
      });

      routes.push({
        path: `${REPORT_BASE_URL}/:step?/:id?`,
        component: config.featureToggles.newShareReportDrawer
          ? () => <RedirectToReportPage />
          : lazy(() => import(/* webpackChunkName: "ReportPage" */ './ReportForm/ReportPage')),
      });
    }
  }
  return routes;
}
