import { SelectDashboardScene } from './SelectDashboards/SelectDashboardScene';

export interface SectionProps {
  dashboards?: SelectDashboardScene[];
  onAddDashboard?: () => void;
  open: boolean;
  onToggle: () => void;
}

export enum SectionId {
  SelectDashboards = 'select-dashboards',
  Schedule = 'schedule',
  EmailConfiguration = 'email-configuration',
  Recipients = 'recipients',
  Attachments = 'attachments',
}
