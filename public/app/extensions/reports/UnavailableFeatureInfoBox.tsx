import * as React from 'react';

import { t } from '@grafana/i18n';
import { InfoBox } from '@grafana/ui';

export interface Props {
  message: string;
}

export const UnavailableFeatureInfoBox: React.FC<Props> = ({ message }) => {
  return (
    <InfoBox
      title={t(
        'reports.unavailable-feature-info-box.title-feature-available-expired-license',
        'Feature not available with an expired license'
      )}
      url="https://grafana.com/docs/grafana/latest/enterprise/license-expiration/"
      urlTitle="Read more on license expiration"
    >
      <span>{message}</span>
    </InfoBox>
  );
};
