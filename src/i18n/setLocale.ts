import { resolveLocale, type Locale } from '@/core/content/locales';
import { i18n } from './index';

/** The UI locales are exactly the content locales; there is one list. */
export type AppLocale = Locale;

export function setLocale(locale: AppLocale): void {
  i18n.global.locale.value = locale;
  //localStorage.setItem('shaderforge-locale', locale);
}

export function getLocale(): AppLocale {
  return resolveLocale(i18n.global.locale.value);
}
