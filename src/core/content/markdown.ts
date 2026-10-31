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

const slugger = new GithubSlugger();

md.use(mermaidFencePlugin);
md.use(markdownItAnchor, {
  slugify: slugger.slug.bind(slugger),
});

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
  return md.render(source);
}