
import { createI18n } from 'vue-i18n';

import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';

const savedLocale = localStorage.getItem('shaderforge-locale');

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale === 'pt-BR' ? 'pt-BR' : 'en',
  fallbackLocale: 'en',
  messages: {
    en,
    'pt-BR': ptBR,
  },
});
