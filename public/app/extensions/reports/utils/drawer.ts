import { t } from '@grafana/i18n';
import { appEvents } from 'app/core/core';
import { ShowConfirmModalEvent } from 'app/types/events';

import { ReportingInteractions } from '../ReportFormV2/reportingInteractions';
import { RenderingContextEnum } from '../dashboard-scene/ReportRenderingProvider';

export const showDiscardReportModal = (onConfirm: () => void, renderingContext: RenderingContextEnum) => {
  const onConfirmDiscard = () => {
    ReportingInteractions.discardClicked(renderingContext);
    onConfirm();
  };

  appEvents.publish(
    new ShowConfirmModalEvent({
      title: t('share-report.discard-changes.title', 'Discard changes to report?'),
      text: t(
        'share-report.discard-changes.text',
        'You have unsaved changes to this dashboard report. Are you sure you want to discard them?'
      ),
      icon: 'trash-alt',
      yesText: t('share-report.discard-changes.discard-button', 'Discard'),
      onConfirm: onConfirmDiscard,
    })
  );
};
