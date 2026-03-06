import {
  ENGLISH_US,
  FRENCH_FRANCE,
  SPANISH_SPAIN,
  GERMAN_GERMANY,
  CHINESE_SIMPLIFIED,
  BRAZILIAN_PORTUGUESE,
  PSEUDO_LOCALE,
} from '@grafana/i18n';
import { LocaleFileLoader } from 'app/core/internationalization/constants';

export const ENTERPRISE_I18N_NAMESPACE = 'grafana-enterprise';

export const LOCALE_EXTENSIONS: Record<string, LocaleFileLoader | undefined> = {
  [ENGLISH_US]: () => import('./en-US/grafana-enterprise.json'),
  [FRENCH_FRANCE]: () => import('./fr-FR/grafana-enterprise.json'),
  [SPANISH_SPAIN]: () => import('./es-ES/grafana-enterprise.json'),
  [GERMAN_GERMANY]: () => import('./de-DE/grafana-enterprise.json'),
  [CHINESE_SIMPLIFIED]: () => import('./zh-Hans/grafana-enterprise.json'),
  [BRAZILIAN_PORTUGUESE]: () => import('./pt-BR/grafana-enterprise.json'),
};

if (process.env.NODE_ENV === 'development') {
  LOCALE_EXTENSIONS[PSEUDO_LOCALE] = () => import('./pseudo-LOCALE/grafana-enterprise.json');
}
