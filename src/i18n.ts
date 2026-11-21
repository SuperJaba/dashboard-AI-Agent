import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import plCommon from './locales/pl/common.json';
import plWidgets from './locales/pl/widgets.json';
import enCommon from './locales/en/common.json';
import enWidgets from './locales/en/widgets.json';
import hiCommon from './locales/hi/common.json';
import hiWidgets from './locales/hi/widgets.json';

const storedLang = typeof window !== 'undefined' ? window.localStorage.getItem('dashboard_language') : null;

i18n
  .use(initReactI18next)
  .init({
    lng: storedLang === 'en' || storedLang === 'hi' ? storedLang : 'pl',
    fallbackLng: 'pl',
    ns: ['common', 'widgets'],
    defaultNS: 'common',
    fallbackNS: ['common', 'widgets'],
    resources: {
      pl: {
        common: plCommon,
        widgets: plWidgets,
      },
      en: {
        common: enCommon,
        widgets: enWidgets,
      },
      hi: {
        common: hiCommon,
        widgets: hiWidgets,
      },
    },
    interpolation: {
      escapeValue: false,
    },
  });

export { i18n };
