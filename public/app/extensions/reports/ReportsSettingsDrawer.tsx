import { useForm, FormProvider } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Alert, Drawer, LoadingPlaceholder } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useGetSettingsQuery, useSaveSettingsMutation } from 'app/extensions/api/clients/reporting';

import { AccessControlAction, FooterMode, ReportsSettings, Theme } from '../types';

import { NoRendererInfoBox } from './RenderingWarnings';
import ReportBranding from './ReportBranding';

interface Props {
  onClose: () => void;
}

export const ReportsSettingsDrawer = ({ onClose }: Props) => {
  const { data: settings, isLoading: isLoadingSettings } = useGetSettingsQuery();

  const renderContent = () => {
    if (isLoadingSettings) {
      return <LoadingPlaceholder text={t('share-report.settings.loading', 'Loading settings...')} />;
    }

    if (!settings) {
      return <Alert title={t('reporting.settings.no-data', 'No settings data available')} severity="warning" />;
    }

    if (!config.rendererAvailable) {
      return <NoRendererInfoBox variant="error" />;
    }

    return <ReportSettingsForm settings={settings} onClose={onClose} />;
  };

  return (
    <Drawer
      title={t('reporting.settings.drawer-title', 'Report template settings')}
      subtitle={t('reporting.settings.settings-subtitle', 'Manage report template settings.')}
      size="md"
      onClose={onClose}
    >
      {renderContent()}
    </Drawer>
  );
};

const ReportSettingsForm = ({ settings, onClose }: { settings?: ReportsSettings; onClose: () => void }) => {
  const [saveSettings, { isLoading: isSavingSettings }] = useSaveSettingsMutation();
  const canEditSettings = contextSrv.hasPermission(AccessControlAction.ReportingSettingsWrite);

  const submitForm = async (formData: ReportsSettings) => {
    await saveSettings(formData).unwrap();
    onClose();
  };

  const formMethods = useForm<ReportsSettings>({
    defaultValues: {
      embeddedImageTheme: Theme.Dark,
      pdfTheme: Theme.Light,
      ...settings,
      branding: {
        emailFooterMode: FooterMode.None,
        emailFooterText: '',
        emailFooterLink: '',
        emailLogoUrl: '',
        reportLogoUrl: '',
        ...settings?.branding,
      },
    },
  });

  const { handleSubmit } = formMethods;

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(submitForm)}>
        <ReportBranding />
        <Button
          type="submit"
          disabled={!canEditSettings || isSavingSettings}
          icon={isSavingSettings ? 'spinner' : undefined}
        >
          {isSavingSettings ? (
            <Trans i18nKey="reporting.settings.saving-button">Saving...</Trans>
          ) : (
            <Trans i18nKey="reporting.settings.save-button">Save</Trans>
          )}
        </Button>
      </form>
    </FormProvider>
  );
};
