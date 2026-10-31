import { parseFrontmatter } from '@/core/content/frontmatter';
import { DEFAULT_LOCALE, isLocale, type Locale } from './locales';

/** Content kinds that participate in the directory-per-locale layout. */
export type ContentKind = 'docs' | 'knowledge';

/** A parsed, publishable document. */
export interface Doc {
  /** Path relative to the locale root, e.g. `docs/shader-editor.md`. */
  relativePath: string;
  /** Full source key, e.g. `pt-BR/docs/shader-editor.md`. */
  sourcePath: string;
  title: string;
  description: string;
  section: string;
  order: number | null;
  draft: boolean;
  body: string;
}

export type ResolveResult =
  | { content: Doc; locale: Locale; isFallback: boolean }
  | { content: null; locale: null; isFallback: false };

/**
 * In-memory content source.
 *
 * Keys are `<locale>/<relativePath>` (e.g. `en/docs/intro.md`). The app builds
 * this from Vite's native `import.meta.glob` loader in `contentSource.ts`;
 * tests pass a plain object.
 */
export type ContentSource = Readonly<Record<string, string>>;

export interface ContentResolverOptions {
  /**
   * Serve drafts from the *default* locale. The dev server enables this so
   * editors can preview work in progress; production builds leave it off.
   *
   * Drafts in other locales are always treated as "not translated yet" and
   * therefore fall back to the default locale. This is what makes the
   * `draft: true` pt-BR stubs render the English original with the fallback
   * notice until a translator publishes them (`draft: false`).
   */
  includeDrafts?: boolean;
}

interface RawFrontmatter {
  title?: unknown;
  description?: unknown;
  section?: unknown;
  order?: unknown;
  draft?: unknown;
}

/**
 * Resolves content for a locale and owns the *entire* fallback policy.
 *
 * Layout convention: `content/<locale>/<relativePath>`, e.g.
 * `content/en/docs/intro.md` and `content/pt-BR/docs/intro.md`. The relative
 * path (including the filename) is the translation key — there are no
 * filename suffixes and no `translationKey` frontmatter.
 *
 * Resolution rules:
 * 1. Try the requested locale.
 * 2. If missing and the locale is not the default, try the default locale and
 *    report `isFallback: true`.
 * 3. If both are missing, return `{ content: null, locale: null }`.
 * 4. Unknown locale codes are normalised to the default locale (see
 *    `locales.ts`), so they behave exactly like a default-locale request.
 */
export class ContentResolver {
  readonly defaultLocale: Locale;

  private readonly source: ContentSource;
  private readonly includeDrafts: boolean;

  constructor(
    defaultLocale: Locale = DEFAULT_LOCALE,
    source: ContentSource = {},
    options: ContentResolverOptions = {},
  ) {
    this.defaultLocale = defaultLocale;
    this.source = source;
    this.includeDrafts = options.includeDrafts === true;
  }

  async resolve(relativePath: string, locale: string): Promise<ResolveResult> {
    const target = this.normalizeLocale(locale);

    const content = this.read(target, relativePath);
    if (content) {
      return { content, locale: target, isFallback: false };
    }

    if (target !== this.defaultLocale) {
      const fallback = this.read(this.defaultLocale, relativePath);
      if (fallback) {
        return {
          content: fallback,
          locale: this.defaultLocale,
          isFallback: true,
        };
      }
    }

    return { content: null, locale: null, isFallback: false };
  }

  /**
   * Whether the exact locale has its own publishable document for this path.
   * Deliberately does *not* consider the fallback: the switcher must not link
   * to a locale that would silently serve another language.
   */
  async hasTranslation(relativePath: string, locale: string): Promise<boolean> {
    return this.read(this.normalizeLocale(locale), relativePath) !== null;
  }

  /**
   * Every relative path present in at least one locale, sorted. Used to build
   * the navigation tree from a single stable spine; fallback happens per path
   * through {@link resolve}.
   */
  relativePaths(kind?: ContentKind): string[] {
    const paths = new Set<string>();

    for (const key of Object.keys(this.source)) {
      const separator = key.indexOf('/');
      if (separator <= 0) continue;

      const locale = key.slice(0, separator);
      if (!isLocale(locale)) continue;

      const relativePath = key.slice(separator + 1);
      if (!relativePath.toLowerCase().endsWith('.md')) continue;
      if (kind && !relativePath.startsWith(`${kind}/`)) continue;

      paths.add(relativePath);
    }

    return [...paths].sort((a, b) => a.localeCompare(b));
  }

  private normalizeLocale(locale: string): Locale {
    return isLocale(locale) ? locale : this.defaultLocale;
  }

  private read(locale: Locale, relativePath: string): Doc | null {
    const relative = normalizeRelativePath(relativePath);
    if (!relative) return null;

    const key = `${locale}/${relative}`;
    const raw = this.source[key];
    if (raw === undefined) return null;

    const { data, body } = parseSafely(key, raw);
    const draft = data.draft === true;

    if (draft) {
      // A draft translation is a stub, not content: never serve it, let
      // `resolve` fall back to the default locale.
      if (locale !== this.defaultLocale) return null;
      if (!this.includeDrafts) return null;
    }

    return {
      relativePath: relative,
      sourcePath: key,
      title: readString(data.title).trim(),
      description: readString(data.description).trim(),
      section: readString(data.section).trim(),
      order:
        typeof data.order === 'number' && Number.isFinite(data.order)
          ? data.order
          : null,
      draft,
      body,
    };
  }
}

/**
 * True when the UI should render the fallback notice for a resolve result.
 * Keeping this check here means no view/component re-implements the policy.
 */
export function showsFallbackNotice(result: ResolveResult): boolean {
  return result.content !== null && result.isFallback;
}

/** An empty result, for callers that need one before resolving. */
export function noContentResult(): ResolveResult {
  return { content: null, locale: null, isFallback: false };
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeRelativePath(value: string): string {
  const relative = value
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/{2,}/g, '/');

  if (!relative || relative.startsWith('/')) return '';

  // Pure in-memory lookup, but reject traversal anyway: the value can come
  // from a route parameter.
  const segments = relative.split('/');
  if (segments.some((segment) => segment === '' || segment === '..')) {
    return '';
  }

  return relative;
}

function parseSafely(key: string, raw: string) {
  try {
    return parseFrontmatter<RawFrontmatter>(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid frontmatter in content/${key}: ${message}`);
  }
}
