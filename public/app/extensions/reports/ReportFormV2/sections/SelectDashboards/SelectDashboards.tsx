import { t } from '@grafana/i18n';
import { Button, Divider, Stack } from '@grafana/ui';
import { selectors } from 'app/extensions/reports/e2e-selectors/selectors';

import ReportSection from '../../ReportSection';
import { SectionProps } from '../types';

export default function SelectDashboards({ dashboards = [], onAddDashboard, open, onToggle }: SectionProps) {
  return (
    <ReportSection
      label={t('share-report.dashboard.section-title', 'Dashboards')}
      isOpen={open}
      onToggle={onToggle}
      dataTestId={selectors.components.ReportFormDrawer.SelectDashboards.header}
      contentDataTestId={selectors.components.ReportFormDrawer.SelectDashboards.content}
    >
      <Stack direction="column" gap={2}>
        {dashboards.map((dashboard, index) => {
          return (
            <Stack direction="column" key={dashboard.state.key}>
              <dashboard.Component model={dashboard} />
              {index < dashboards.length - 1 && <Divider spacing={0} />}
            </Stack>
          );
        })}
      </Stack>
      <Divider />
      <Button variant="primary" fill="text" onClick={onAddDashboard}>
        + {t('share-report.dashboard.add-dashboard', 'Add dashboard')}
      </Button>
    </ReportSection>
  );
}
