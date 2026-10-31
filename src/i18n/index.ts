import { createI18n } from 'vue-i18n';

import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';

export const i18n = createI18n({
  legacy: false,
  locale: 'pt-BR',      // always boot in Portuguese
  fallbackLocale: 'en', // keep English as the fallback
  messages: {
    en,
    'pt-BR': ptBR,
  },
});
