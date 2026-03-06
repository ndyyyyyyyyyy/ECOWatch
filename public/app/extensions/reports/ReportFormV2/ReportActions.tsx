import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { ReportState } from '../../types';
import { selectors } from '../e2e-selectors/selectors';

import ActionsMenu from './components/ActionsMenu';
import { SendPreviewToggletip } from './components/SendPreviewToggletip';
import { SelectDashboardScene } from './sections/SelectDashboards/SelectDashboardScene';

export function ReportActions({
  isUpsertLoading,
  isSaveDraftLoading,
  isUpdateStateReportLoading,
  onSaveDraftClick,
  onDeleteClick,
  onToggleStateClick,
  sceneDashboards,
  isEditMode,
  reportState,
}: {
  isUpsertLoading: boolean;
  isSaveDraftLoading: boolean;
  isUpdateStateReportLoading: boolean;
  onSaveDraftClick: () => void;
  onDeleteClick: () => void;
  onToggleStateClick: () => void;
  sceneDashboards: SelectDashboardScene[];
  isEditMode: boolean;
  reportState: ReportState | undefined;
}) {
  const {
    formState: { isDirty },
  } = useFormContext();

  return (
    <Stack justifyContent="space-between" direction={{ xs: 'column', md: 'row' }} gap={{ xs: 2, md: 0 }}>
      <Stack gap={1}>
        <ActionsMenu sceneDashboards={sceneDashboards} />
        <SendPreviewToggletip sceneDashboards={sceneDashboards} />
      </Stack>
      <Stack gap={{ xs: 2, md: 1 }} direction={{ xs: 'column', md: 'row' }}>
        <Button
          type="submit"
          variant="primary"
          data-testid={selectors.components.ReportFormDrawer.submitButton}
          icon={isUpsertLoading ? 'spinner' : undefined}
          fullWidth
        >
          {isEditMode && reportState !== ReportState.Draft
            ? isUpsertLoading
              ? t('share-report.update-report.updating-button', 'Updating report...')
              : t('share-report.update-report.button', 'Update report')
            : isUpsertLoading
              ? t('share-report.schedule-report.scheduling-button', 'Scheduling report...')
              : t('share-report.schedule-report.button', 'Schedule report')}
        </Button>
        {(!isEditMode || reportState === ReportState.Draft) && (
          <Button
            variant="secondary"
            icon={isSaveDraftLoading ? 'spinner' : undefined}
            onClick={onSaveDraftClick}
            fullWidth
          >
            {isSaveDraftLoading
              ? t('share-report.save-draft.saving-button', 'Saving draft...')
              : t('share-report.save-draft.button', 'Save draft')}
          </Button>
        )}
        {(reportState === ReportState.Scheduled || reportState === ReportState.Paused) && (
          <Button
            variant="secondary"
            disabled={isDirty}
            icon={reportState === ReportState.Scheduled ? 'pause' : 'play'}
            onClick={onToggleStateClick}
            fullWidth
          >
            {reportState === ReportState.Scheduled
              ? isUpdateStateReportLoading
                ? t('share-report.update-report.pausing-button', 'Pausing report...')
                : t('share-report.update-report.pause-button', 'Pause')
              : isUpdateStateReportLoading
                ? t('share-report.update-report.resuming-button', 'Resuming report...')
                : t('share-report.update-report.resume-button', 'Resume')}
          </Button>
        )}
        {reportState && (
          <Button icon="trash-alt" variant="destructive" onClick={onDeleteClick} fullWidth>
            {t('share-report.update-report.delete-button', 'Delete')}
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
