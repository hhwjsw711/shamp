import 'i18next'
import type { defaultNS, resources } from '../i18n'

declare module 'i18next' {
  interface CustomTypeOptions {
    // Set default namespace
    defaultNS: typeof defaultNS

    // Resources type for type-safe translation keys
    resources: typeof resources['en']

    // Enable selector API for better TypeScript support
    enableSelector: true

    // Return type settings
    returnNull: false
    returnEmptyString: false
  }
}
