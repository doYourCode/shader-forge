import { i18n } from './index';

export type AppLocale = 'en' | 'pt-BR';

export function setLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale;
  //localStorage.setItem('shaderforge-locale', locale);
}

export function getLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale;
}
