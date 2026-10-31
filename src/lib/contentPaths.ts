import type { ContentKind } from './ContentResolver';
import { DEFAULT_LOCALE, type Locale } from './locales';

/** Translation key for a document: `<kind>/<slug>.md`. */
export function relativePathFor(kind: ContentKind, slug: string): string {
  return `${kind}/${slug}.md`;
}

/**
 * Canonical URL for a document. The default locale has no prefix (`/docs/x`);
 * every other locale is prefixed (`/pt-BR/docs/x`).
 *
 * This is the only place that knows the URL shape, so the router, the tree and
 * the language switcher cannot drift apart.
 */
export function contentPath(
  locale: Locale,
  kind: ContentKind,
  slug?: string | null,
): string {
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return slug ? `${prefix}/${kind}/${slug}` : `${prefix}/${kind}`;
}
