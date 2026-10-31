import { LOCALES } from './locales';
import type { ContentSource } from './ContentResolver';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches Vite's glob keys, e.g. `/content/pt-BR/docs/intro.md`. */
const CONTENT_KEY = new RegExp(
  `^/content/(${LOCALES.map(escapeRegExp).join('|')})/(.+)$`,
);

/**
 * Vite's native content API: every markdown file under a locale tree is
 * imported eagerly as raw text at build time. No new dependency and no
 * runtime fetch — the same mechanism the old single-tree loader used.
 */
const modules = import.meta.glob('/content/*/{docs,knowledge}/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Normalises Vite's glob keys to `<locale>/<relativePath>`, which is the key
 * shape {@link ContentResolver} expects.
 */
export function loadContentSource(): ContentSource {
  const source: Record<string, string> = {};

  for (const [path, raw] of Object.entries(modules)) {
    const match = CONTENT_KEY.exec(path);
    if (match) source[`${match[1]}/${match[2]}`] = raw;
  }

  return source;
}
