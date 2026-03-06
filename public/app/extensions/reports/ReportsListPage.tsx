import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config, featureEnabled } from '@grafana/runtime';
import { Box, Button, EmptyState, Icon, Input, LinkButton, Spinner, Stack, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { UpgradeBox } from 'app/core/components/Upgrade/UpgradeBox';
import { contextSrv } from 'app/core/core';
import { useUrlParams } from 'app/core/navigation/hooks';
import { highlightTrial } from 'app/features/admin/utils';

import { useDeleteReportMutation, useGetReportsQuery, useUpdateReportMutation } from '../api/clients/reporting';
import { Report, AccessControlAction } from '../types';

import { NoRendererInfoBox, OldRendererInfoBox } from './RenderingWarnings';
import { ReportList } from './ReportsList';
import { ReportsSettingsDrawer } from './ReportsSettingsDrawer';
import { ReportUpgradeContent } from './ReportsUpgradePage';
import { UnavailableFeatureInfoBox } from './UnavailableFeatureInfoBox';
import { UpsertReportDrawer } from './UpsertReportDrawer';
import { NEW_REPORT_URL, REPORT_BASE_URL } from './constants';
import { selectors } from './e2e-selectors/selectors';
import { getRendererMajorVersion } from './utils/renderer';
import { transformReportDTOV2ToReport, transformReportToReportDTOV2 } from './utils/serialization';

export const ReportsListPage = () => {
  const [filter, setFilter] = useState('');

  const [params, updateUrlParams] = useUrlParams();
  const isSettingsDrawerOpen = params.get('reportView') === 'settings';
  const reportId = Number(params.get('reportId'));
  const isReportDrawerOpen = params.get('reportView') === 'new' || !!reportId;

  const isShareReportDrawerEnabled = config.featureToggles.newShareReportDrawer;

  const { data: reportsList, isLoading: isReportsLoading, isFetching: isReportsFetching } = useGetReportsQuery();
  const [deleteReport, { isLoading: isDeleteReportLoading }] = useDeleteReportMutation();
  const [updateReport, { isLoading: isUpdateReportLoading }] = useUpdateReportMutation();

  const reports: Report[] = reportsList?.map((report) => transformReportDTOV2ToReport(report)) || [];

  const openNewReportDrawer = () => {
    updateUrlParams({ reportView: 'new' });
  };

  const onDeleteReportClick = (report: Report) => {
    deleteReport(report.id);
  };

  const onUpdateReportClick = async (report: Report) => {
    const reportDTO = transformReportToReportDTOV2(report);
    updateReport(reportDTO);
  };

  const handleOpenSettingsDrawer = () => {
    updateUrlParams({ reportView: 'settings' });
  };

  const handleCloseSettingsDrawer = () => {
    updateUrlParams({ reportView: null });
  };

  const renderList = () => {
    const { rendererAvailable } = config;
    const rendererMajorVersion = getRendererMajorVersion();
    const canCreateReport = contextSrv.hasPermission(AccessControlAction.ReportingCreate);
    const enableNewReport = rendererAvailable && canCreateReport;

    const list = (
      <ReportList
        reports={reports}
        deleteReport={onDeleteReportClick}
        updateReport={onUpdateReportClick}
        filter={filter}
        redirectTo={
          isShareReportDrawerEnabled
            ? (report) => `${REPORT_BASE_URL}?reportId=${report.id}`
            : (report) => `${REPORT_BASE_URL}/confirm/${report.id}`
        }
      />
    );

    if (!featureEnabled('reports.creation')) {
      return (
        <>
          <UnavailableFeatureInfoBox
            message="Creating new reports is not available with an expired license.
              Existing reports continue to be processed but you need to update your license to create a new one."
          />
          {reports.length > 0 && list}
        </>
      );
    }

    return (
      <>
        {!rendererAvailable && <NoRendererInfoBox variant="error" />}
        {rendererAvailable && rendererMajorVersion !== null && rendererMajorVersion < 3 && <OldRendererInfoBox />}
        {highlightTrial() && (
          <UpgradeBox
            featureId={'reporting'}
            eventVariant={'trial'}
            featureName={'reporting'}
            text={t(
              'reports.reports-list-page.render-list.text-create-unlimited-reports-during-trial-grafana',
              'Create unlimited reports during your trial of Grafana Pro.'
            )}
          />
        )}
        {reports.length > 0 ? (
          <>
            <div className="page-action-bar">
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" flex={1}>
                <Box maxWidth={56} width="100%">
                  <Input
                    placeholder={t(
                      'reports.reports-list-page.render-list.placeholder-search-reports-report-dashboard-recipients',
                      'Search reports by report name, dashboard name or recipients'
                    )}
                    prefix={<Icon name={'search'} />}
                    onChange={(e) => setFilter((e.target as HTMLInputElement).value)}
                  />
                </Box>
                <Stack alignItems="center">
                  {(isUpdateReportLoading || isDeleteReportLoading || isReportsFetching) && <Spinner />}
                  {isShareReportDrawerEnabled ? (
                    <Button variant="primary" onClick={openNewReportDrawer} disabled={!enableNewReport} icon={'plus'}>
                      <Trans i18nKey="reports.reports-list-page.render-list.create-a-new-report">
                        Create a new report
                      </Trans>
                    </Button>
                  ) : (
                    <LinkButton variant="primary" href={NEW_REPORT_URL} disabled={!enableNewReport} icon={'plus'}>
                      <Trans i18nKey="reports.reports-list-page.render-list.create-a-new-report">
                        Create a new report
                      </Trans>
                    </LinkButton>
                  )}
                </Stack>
              </Stack>
            </div>
            {list}
          </>
        ) : (
          rendererAvailable &&
          (highlightTrial() ? (
            <ReportUpgradeContent
              action={{
                text: t('reports.reports-list-page.render-list.text.create-report', 'Create report'),
                link: !isShareReportDrawerEnabled ? NEW_REPORT_URL : undefined,
                onClick: isShareReportDrawerEnabled ? openNewReportDrawer : undefined,
              }}
            />
          ) : (
            <EmptyState
              variant="call-to-action"
              button={
                isShareReportDrawerEnabled ? (
                  <Button
                    disabled={!enableNewReport}
                    onClick={openNewReportDrawer}
                    icon="plus"
                    size="lg"
                    data-testid={selectors.components.ReportingListPage.createButton}
                  >
                    <Trans i18nKey="reporting.page.empty-button">Create report</Trans>
                  </Button>
                ) : (
                  <LinkButton
                    disabled={!enableNewReport}
                    href={NEW_REPORT_URL}
                    icon="plus"
                    size="lg"
                    data-testid={selectors.components.ReportingListPage.createButton}
                  >
                    <Trans i18nKey="reporting.page.empty-button">Create report</Trans>
                  </LinkButton>
                )
              }
              message={t('reporting.page.empty-title', 'There are no reports created yet')}
            >
              <Trans i18nKey="reporting.page.empty-pro-tip">
                Create a report from any existing dashboards.{' '}
                <TextLink external href="https://grafana.com/docs/grafana/latest/dashboards/create-reports/">
                  Learn more
                </TextLink>
              </Trans>
            </EmptyState>
          ))
        )}
      </>
    );
  };

  const renderPageHeaderActions = () => {
    const canReadSettings = contextSrv.hasPermission(AccessControlAction.ReportingSettingsRead);

    return (
      <Button icon="cog" variant="secondary" onClick={handleOpenSettingsDrawer} disabled={!canReadSettings}>
        <Trans i18nKey="reporting.page.settings-button">Report settings</Trans>
      </Button>
    );
  };

  return (
    <Page
      navId="reports"
      subTitle="Manage automatically generated PDF reports from any dashboards and have Grafana email them to interested parties."
      actions={renderPageHeaderActions()}
    >
      <Page.Contents isLoading={isReportsLoading}>{renderList()}</Page.Contents>
      {isSettingsDrawerOpen && <ReportsSettingsDrawer onClose={handleCloseSettingsDrawer} />}
      {isReportDrawerOpen && isShareReportDrawerEnabled && <UpsertReportDrawer />}
    </Page>
  );
};

export default ReportsListPage;
