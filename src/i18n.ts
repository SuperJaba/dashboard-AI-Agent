import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import plCommon from './locales/pl/common.json';
import plWidgets from './locales/pl/widgets.json';
import enCommon from './locales/en/common.json';
import enWidgets from './locales/en/widgets.json';

i18n
  .use(initReactI18next)
  .init({
    lng: localStorage.getItem('dashboard_language') || 'pl',
    fallbackLng: 'pl',
    resources: {
      pl: {
        common: plCommon,
        widgets: plWidgets,
      },
      en: {
        common: enCommon,
        widgets: enWidgets,
      },
    },
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });

export { i18n };
