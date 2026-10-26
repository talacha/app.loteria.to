import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

// Minimal bootstrap. UI catalogs (es default, en) are added by the app/content agents.
void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    lng: 'es',
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    resources: { es: { translation: {} }, en: { translation: {} } },
    interpolation: { escapeValue: false },
  });

export default i18n;
