import type { ContentKind } from './ContentResolver';

/** Translation key for a document: `<kind>/<slug>.md`. */
export function relativePathFor(kind: ContentKind, slug: string): string {
  return `${kind}/${slug}.md`;
}

/**
 * Canonical URL for a document. Locale-neutral by design: the header language
 * selector decides which locale the resolver serves.
 */
export function contentPath(
  kind: ContentKind,
  slug?: string | null,
): string {
  return slug ? `/${kind}/${slug}` : `/${kind}`;
}
