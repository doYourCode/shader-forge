/**
 * Lesson metadata authored in frontmatter.
 *
 * These fields are optional and additive: a plain reference page can omit all
 * of them and still resolve. They power the difficulty badge, the "Open in
 * editor" callout, the learning path and the authoring guide. Every new key
 * must also be declared in `.pages.yml`, otherwise the CMS cannot edit it.
 */

/** How much prior knowledge a lesson assumes. Reference pages use `null`. */
export type ContentDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** The editor a lesson opens in; mirrors the three routes. */
export type ContentEditor = 'editor' | 'sandbox' | 'screen-space';

const DIFFICULTIES: readonly ContentDifficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
];

const EDITORS: readonly ContentEditor[] = ['editor', 'sandbox', 'screen-space'];

export function isContentDifficulty(
  value: unknown,
): value is ContentDifficulty {
  return (
    typeof value === 'string' &&
    (DIFFICULTIES as readonly string[]).includes(value)
  );
}

export function isContentEditor(value: unknown): value is ContentEditor {
  return (
    typeof value === 'string' && (EDITORS as readonly string[]).includes(value)
  );
}

export function parseDifficulty(value: unknown): ContentDifficulty | null {
  return isContentDifficulty(value) ? value : null;
}

export function parseEditor(value: unknown): ContentEditor | null {
  return isContentEditor(value) ? value : null;
}

/**
 * Reads a slug list from either a YAML sequence or the comma-separated string
 * the CMS text field produces. Empty entries are discarded.
 */
export function parseStringList(value: unknown): readonly string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return raw
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}

/** True only for the exact YAML boolean, never for the string "true". */
export function parseBoolean(value: unknown): boolean {
  return value === true;
}
