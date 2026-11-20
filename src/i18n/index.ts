import { createI18n } from 'vue-i18n';

import { DEFAULT_LOCALE, PT_BR_LOCALE } from '@/core/content/locales';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';

export const i18n = createI18n({
  legacy: false,
  locale: PT_BR_LOCALE, // Always boot in Portuguese
  fallbackLocale: DEFAULT_LOCALE, // keep English as the fallback
  messages: {
    en,
    [PT_BR_LOCALE]: ptBR,
  },
});
