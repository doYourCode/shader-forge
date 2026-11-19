/**
 * Single source of truth for *content* locales.
 *
 * UI-string i18n (vue-i18n messages in `src/i18n/locales`) is a separate
 * concern and is intentionally not touched by this module. A content locale
 * determines which `content/<locale>/...` tree is read.
 */
export const LOCALES = ['en', 'pt-BR'] as const;

/** Locale served when no translation exists or the requested code is unknown. */
export const DEFAULT_LOCALE = 'en';

/**
 * Named alias for pt-BR. Use it instead of a bare `'pt-BR'` string when a
 * locale code has to appear in code (e.g. fixed Portuguese notice copy).
 */
export const PT_BR_LOCALE = 'pt-BR';

export type Locale = (typeof LOCALES)[number];

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Normalises an arbitrary locale code.
 *
 * Documented policy: an unknown code is treated as {@link DEFAULT_LOCALE}
 * (`en`) rather than rejected, so a stale/hand-typed URL still renders the
 * English original instead of a blank page.
 */
export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
