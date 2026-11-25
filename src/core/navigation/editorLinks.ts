/**
 * Deep links into the three editing screens.
 *
 * The same builder feeds the Markdown "Run this" buttons, the frontmatter
 * "Open in editor" callout and the copyable examples in the docs, so a link
 * cannot disagree with the editor that consumes it. Query parsing is kept here
 * (not in the views) so it is unit-testable without a router.
 */

import type { ContentEditor } from '@/core/content/contentMetadata';

export type EditorTarget = ContentEditor;

export interface EditorDeepLink {
  readonly target: EditorTarget;
  /** Bundled material or sandbox example id (`phong`, `gradient`). */
  readonly example?: string | null;
  /** Bundled post-effect example id (`vignette`, `blur`). */
  readonly effect?: string | null;
  /** Inline GLSL source, encoded into the `code` query parameter. */
  readonly code?: string | null;
  /** Optional initial tab, using the editor's own tab ids. */
  readonly tab?: string | null;
}

const TARGETS: readonly EditorTarget[] = ['editor', 'sandbox', 'screen-space'];

export function isEditorTarget(value: unknown): value is EditorTarget {
  return (
    typeof value === 'string' && (TARGETS as readonly string[]).includes(value)
  );
}

/**
 * Builds a locale-neutral relative URL. `URLSearchParams` percent-encodes the
 * code, so a shader containing `#`, `&` or newlines is still one parameter.
 */
export function editorPath(link: EditorDeepLink): string {
  const params = new URLSearchParams();

  if (link.example) params.set('example', link.example);
  if (link.effect) params.set('effect', link.effect);
  if (link.code) params.set('code', link.code);
  if (link.tab) params.set('tab', link.tab);

  const query = params.toString();
  return `/${link.target}${query ? `?${query}` : ''}`;
}

export interface EditorQuery {
  readonly example: string | null;
  readonly effect: string | null;
  readonly code: string | null;
  readonly tab: string | null;
}

type QueryValue = string | null | readonly (string | null)[] | undefined;

/** Reads one query value, tolerating Vue Router's array form. */
function first(value: QueryValue): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' && value[0].length > 0
      ? value[0]
      : null;
  }
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Parses the editor route query into the same shape `editorPath` produces. */
export function parseEditorQuery(
  query: Readonly<Record<string, QueryValue>>,
): EditorQuery {
  return {
    example: first(query.example),
    effect: first(query.effect),
    code: first(query.code),
    tab: first(query.tab),
  };
}
