import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import GithubSlugger from 'github-slugger';
import { mermaidFencePlugin } from './mermaid';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
});

/**
 * The anchor plugin needs a fresh slugger per render: `GithubSlugger` remembers
 * every slug it has produced, so a shared instance would suffix the same heading
 * differently on the second render. Per-render uniqueness still lives in the
 * markdown-it env, so the `-1` suffixes within one document are unchanged.
 */
const slugger = new GithubSlugger();

/** The MarkdownIt instance type (the default import is the constructor). */
type MarkdownEngine = InstanceType<typeof MarkdownIt>;

const CONTAINER_TYPES = ['solution', 'note', 'warning'] as const;
type ContainerType = (typeof CONTAINER_TYPES)[number];

md.use(mermaidFencePlugin);
md.use(glossaryPlugin);
md.use(codeBlockPlugin);
md.use(containerPlugin);
md.use(markdownItAnchor, {
  slugify: slugger.slug.bind(slugger),
});

/** A heading extracted for the on-page table of contents. */
export interface MarkdownHeading {
  /** Heading level; the TOC keeps levels 2 and 3. */
  readonly level: number;
  /** Plain text of the heading, without inline markup. */
  readonly text: string;
  /** Id markdown-it-anchor wrote on the heading element. */
  readonly id: string;
}

/** Rendered HTML plus the headings that can appear in a table of contents. */
export interface RenderedMarkdown {
  readonly html: string;
  readonly headings: readonly MarkdownHeading[];
}

/** Attributes a fenced code block can add after the language. */
export interface CodeBlockOptions {
  /** `sandbox` and `screen-space` snippets get a Run this button. */
  readonly run: 'sandbox' | 'screen-space' | 'editor' | null;
  /** Bundled example id; turns the run action into an editor deep link. */
  readonly example: string | null;
  /** Bundled post-effect example id (`vignette`, `blur`, …). */
  readonly effect: string | null;
  /** Optional visible title above the code. */
  readonly title: string | null;
}

/**
 * Prefix root-relative URLs with Vite's base so images and links work on
 * GitHub Pages project sites such as /shader-forge/.
 */
function withBase(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path}`;
}

const normalizeLink = md.normalizeLink.bind(md);

md.normalizeLink = (url: string): string => withBase(normalizeLink(url));

const defaultLinkOpen = md.renderer.rules.link_open;

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const href = String(token.attrGet('href') ?? '');

  if (/^https?:\/\//i.test(href)) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }

  return defaultLinkOpen
    ? defaultLinkOpen(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};

export function renderMarkdown(source: string): string {
  return renderMarkdownDocument(source).html;
}

/**
 * Renders once and returns both the HTML and the headings, so the content pane
 * and its table of contents can never disagree about heading ids.
 */
export function renderMarkdownDocument(source: string): RenderedMarkdown {
  const tokens = parse(source);
  const headings = collectHeadings(tokens);
  const env = {};

  return {
    html: md.renderer.render(tokens, md.options, env),
    headings,
  };
}

/** Headings for a document rendered elsewhere; parsed with the same rules. */
export function extractMarkdownHeadings(
  source: string,
): readonly MarkdownHeading[] {
  return collectHeadings(parse(source));
}

function parse(source: string) {
  slugger.reset();
  return md.parse(source, {});
}

/** Uses the id markdown-it-anchor already assigned to the heading token. */
function collectHeadings(
  tokens: ReturnType<MarkdownEngine['parse']>,
): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'heading_open') continue;

    const level = Number(token.tag.slice(1));
    if (level < 2 || level > 3) continue;

    const id = token.attrGet('id');
    const headingId = typeof id === 'string' ? id : null;
    const inline = tokens[index + 1];
    if (!headingId || !inline) continue;

    headings.push({
      level,
      text: getTokensText(inline.children ?? []).trim(),
      id: headingId,
    });
  }

  return headings;
}

/**
 * Same text extraction markdown-it-anchor uses for the slug, so a heading with
 * `inline code` produces the same label the anchor hashed.
 */
function getTokensText(children: readonly { type: string; content: string }[]) {
  return children
    .filter((token) => token.type === 'text' || token.type === 'code_inline')
    .map((token) => token.content)
    .join('');
}

/* ------------------------------- glossary -------------------------------- */

const GLOSSARY_PATTERN = /^\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/;

/**
 * `[[term|definition]]` renders an `<abbr>` whose title is the definition.
 * Keeping the definition inline means lessons stay editable in Pages CMS: a
 * glossary page is a normal Markdown document, not a hard-coded dictionary.
 */
function glossaryPlugin(instance: MarkdownEngine): void {
  instance.inline.ruler.before('link', 'glossary_term', (state, silent) => {
    const match = GLOSSARY_PATTERN.exec(state.src.slice(state.pos));
    if (!match) return false;

    const term = match[1]?.trim() ?? '';
    const definition = match[2]?.trim() ?? '';
    if (!term) return false;

    if (!silent) {
      const token = state.push('html_inline', '', 0);
      token.content = definition
        ? `<abbr class="glossary-term" title="${escapeHtmlAttribute(definition)}">${escapeHtmlText(term)}</abbr>`
        : `<span class="glossary-term">${escapeHtmlText(term)}</span>`;
    }

    state.pos += match[0].length;
    return true;
  });
}

/* ------------------------------ code fences ------------------------------- */

/**
 * Adds a toolbar to ordinary fenced code blocks: Copy always, plus Run this
 * when the fence declares a runnable target.
 *
 * Info string: ```glsl run=sandbox title="Gradient"
 * Also accepted: ```glsl example=phong` (opens that bundled 3D example).
 */
function codeBlockPlugin(instance: MarkdownEngine): void {
  const renderPrevious = instance.renderer.rules.fence;

  instance.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const language = fenceLanguage(token.info);

    // Mermaid placeholders are owned by mermaidFencePlugin, which was
    // installed first and therefore sits underneath this renderer.
    if (language === 'mermaid') {
      return renderPrevious
        ? renderPrevious(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    }

    const codeOptions = parseCodeBlockOptions(token.info);
    const code = instance.utils.escapeHtml(token.content);
    const languageClass = language
      ? ` class="language-${escapeHtmlAttribute(language)}"`
      : '';

    return [
      '<div class="code-block">',
      renderCodeToolbar(language, codeOptions),
      `<pre><code${languageClass}>${code}</code></pre>`,
      '</div>',
    ].join('');
  };
}

function parseCodeBlockOptions(info: string): CodeBlockOptions {
  const attributes = new Map<string, string>();

  for (const part of info.trim().split(/\s+/u).slice(1)) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;

    const key = part.slice(0, separator).toLowerCase();
    const value = part
      .slice(separator + 1)
      .replace(/^["']|["']$/g, '');
    attributes.set(key, value);
  }

  const run = attributes.get('run');
  const example = attributes.get('example')?.trim() || null;
  const effect = attributes.get('effect')?.trim() || null;
  const title = attributes.get('title')?.trim() || null;

  return {
    run:
      run === 'sandbox' || run === 'screen-space' || run === 'editor'
        ? run
        : example || effect
          ? 'editor'
          : null,
    example,
    effect,
    title,
  };
}

function renderCodeToolbar(
  language: string,
  options: CodeBlockOptions,
): string {
  const label = language ? `<span class="code-block__lang">${escapeHtmlText(language)}</span>` : '';
  const title = options.title
    ? `<span class="code-block__title">${escapeHtmlText(options.title)}</span>`
    : '';
  const runButton = options.run
    ? renderRunButton(options)
    : '';

  return [
    '<div class="code-block__toolbar">',
    label,
    title,
    '<span class="code-block__spacer"></span>',
    '<button type="button" class="code-block__action" data-code-action="copy">Copy</button>',
    runButton,
    '</div>',
  ].join('');
}

function renderRunButton(options: CodeBlockOptions): string {
  if (options.effect !== null) {
    const target = options.run === 'sandbox' ? 'sandbox' : 'editor';
    const effect = escapeHtmlAttribute(options.effect);

    return `<button type="button" class="code-block__action code-block__action--primary" data-code-action="run" data-run-target="${target}" data-effect="${effect}">Open post effect</button>`;
  }

  const opensExample = options.example !== null;

  if (opensExample) {
    const target = options.run === 'sandbox' ? 'sandbox' : 'editor';
    const example = escapeHtmlAttribute(options.example ?? '');

    return `<button type="button" class="code-block__action code-block__action--primary" data-code-action="run" data-run-target="${target}" data-example="${example}">Open in editor</button>`;
  }

  const target = options.run === 'screen-space' ? 'screen-space' : 'sandbox';
  const label = target === 'screen-space' ? 'Open in Screen Space' : 'Run this';

  return `<button type="button" class="code-block__action code-block__action--primary" data-code-action="run" data-run-target="${target}">${label}</button>`;
}

function fenceLanguage(info: string): string {
  return info.trim().split(/\s+/u, 1)[0] ?? '';
}

/* ------------------------------- containers ------------------------------- */

/**
 * Block containers for the lesson template:
 *
 *   ::: solution Solution 1
 *   Markdown, including fenced code, goes here.
 *   :::
 *
 * `solution` renders a native <details>, so it is collapsible without script.
 * `html: false` still applies to author text; only these generated tags are
 * emitted.
 */
function containerPlugin(instance: MarkdownEngine): void {
  for (const type of CONTAINER_TYPES) {
    instance.block.ruler.before(
      'fence',
      `container_${type}`,
      (state, startLine, endLine, silent) => {
        if (state.sCount[startLine] - state.blkIndent >= 4) return false;

        const start = state.bMarks[startLine] + state.tShift[startLine];
        const end = state.eMarks[startLine];
        const match = /^:::+\s*(\w+)\s*(.*)$/.exec(
          state.src.slice(start, end),
        );

        if (!match || match[1] !== type) return false;
        if (silent) return true;

        let nextLine = startLine + 1;
        let found = false;

        for (; nextLine < endLine; nextLine += 1) {
          const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
          const lineEnd = state.eMarks[nextLine];
          if (/^:::+\s*$/.test(state.src.slice(lineStart, lineEnd))) {
            found = true;
            break;
          }
        }

        if (!found) return false;

        const open = state.push(`container_${type}_open`, 'div', 1);
        open.info = match[2]?.trim() ?? '';
        open.map = [startLine, nextLine];

        const previousParent = state.parentType;
        state.parentType = `container_${type}`;
        state.md.block.tokenize(state, startLine + 1, nextLine);
        state.parentType = previousParent;

        state.push(`container_${type}_close`, 'div', -1);
        state.line = nextLine + 1;
        return true;
      },
      { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
    );

    instance.renderer.rules[`container_${type}_open`] = (tokens, idx) =>
      renderContainerOpen(type, tokens[idx].info);
    instance.renderer.rules[`container_${type}_close`] = () =>
      type === 'solution' ? '</details>\n' : '</aside>\n';
  }
}

function renderContainerOpen(type: ContainerType, info: string): string {
  const title = escapeHtmlText(info || 'Solution');

  if (type === 'solution') {
    return `<details class="solution"><summary>${title}</summary>\n`;
  }

  const label = type === 'note' ? 'Note' : 'Warning';
  return `<aside class="callout callout--${type}"><p class="callout__title">${label}</p>\n`;
}

/* -------------------------------- helpers --------------------------------- */

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, '&quot;');
}

