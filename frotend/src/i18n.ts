import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import translationEN from './locales/en/translation'
import translationZH from './locales/zh-CN/translation'

// Define resources
export const defaultNS = 'translation'
export const resources = {
  en: {
    translation: translationEN,
  },
  'zh-CN': {
    translation: translationZH,
  },
} as const

// Initialize i18next
i18next
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    // Resources
    resources,
    defaultNS,

    // Language settings
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh-CN'],

    // Language detection settings
    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator'],
      // Cache user language selection
      caches: ['localStorage'],
      // localStorage key name
      lookupLocalStorage: 'i18nextLng',
    },

    // Interpolation settings
    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // TypeScript settings (will be configured in i18next.d.ts)
    // Enable type-safe selector API
    returnNull: false,
    returnEmptyString: false,

    // Debug mode (disable in production)
    debug: import.meta.env.DEV,
  })

export default i18next
