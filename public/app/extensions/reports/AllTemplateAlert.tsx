import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

export const AllTemplateAlert = () => {
  return (
    <Alert severity="warning" title={t('reports.all-template-alert.title-not-supported', 'Not supported')}>
      <Trans i18nKey="reports.all-template-alert.description-not-supported">
        The value All in template variables used in repeating rows or panels is not supported in PDF
      </Trans>
    </Alert>
  );
};
