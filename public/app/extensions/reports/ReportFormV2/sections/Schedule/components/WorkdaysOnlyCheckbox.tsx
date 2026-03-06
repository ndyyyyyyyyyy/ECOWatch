import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox } from '@grafana/ui';

export function WorkdaysOnlyCheckbox() {
  const { register } = useFormContext();

  return (
    <Checkbox
      {...register('schedule.workdaysOnly')}
      label={t('share-report.schedule.workdays-only', 'Send Monday to Friday only')}
    />
  );
}
