import { SelectableValue } from '@grafana/data';
import grafanaIconSvg from 'img/grafana_icon.svg';

export const defaultReportLogo = grafanaIconSvg;
export const defaultEmailLogo = 'https://grafana.com/static/assets/img/grafana_logo_lockup_ltbg.png';

export const REPORT_BASE_URL = '/reports';
export const SETTINGS_URL = `${REPORT_BASE_URL}?reportView=settings`;
export const NEW_REPORT_URL = 'reports/select-dashboard';
export const API_ROOT = 'api/reports/images/';
export const API_RENDER_PDFS = 'api/reports/render/pdfs/';
export const API_RENDER_CSVS = 'api/reports/render/csvs/';
export const DEFAULT_EMAIL_MESSAGE =
  'Hi, \nPlease find attached a PDF status report. If you have any questions, feel free to contact me!\nBest,';

export const defaultZoom = 100;

export const getZoomOptions = (isNewPDFRenderingEnabled: boolean): Array<SelectableValue<number>> => [
  { value: 50, label: '50%', isDisabled: !isNewPDFRenderingEnabled },
  { value: 75, label: '75%' },
  { value: 100, label: '100%' },
  { value: 125, label: '125%', isDisabled: !isNewPDFRenderingEnabled },
  { value: 150, label: '150%', isDisabled: !isNewPDFRenderingEnabled },
  { value: 175, label: '175%', isDisabled: !isNewPDFRenderingEnabled },
  { value: 200, label: '200%' },
];
