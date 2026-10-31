import type { MarkdownIt } from 'markdown-it';

/** Fence info word that opts a code block into diagram rendering. */
export const MERMAID_LANGUAGE = 'mermaid';

/** Attribute holding the diagram source emitted with each placeholder. */
export const MERMAID_SOURCE_ATTRIBUTE = 'data-mermaid-source';

/** Attribute recording a placeholder's render lifecycle. */
export const MERMAID_STATE_ATTRIBUTE = 'data-mermaid-state';

/**
 * Turns ```mermaid fenced code blocks into inert placeholders.
 *
 * Markdown rendering stays synchronous and side-effect free: Mermaid needs a
 * live DOM and is therefore loaded lazily by the service that consumes these
 * placeholders (see `src/services/mermaid/MermaidService.ts`).
 */
export function mermaidFencePlugin(md: MarkdownIt): void {
  const renderDefaultFence = md.renderer.rules.fence;

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];

    if (fenceLanguage(token.info) !== MERMAID_LANGUAGE) {
      return renderDefaultFence
        ? renderDefaultFence(tokens, idx, options, env, self)
        : self.renderToken(tokens, idx, options);
    }

    return renderMermaidPlaceholder(token.content);
  };
}

export function renderMermaidPlaceholder(source: string): string {
  return (
    `<div class="mermaid-diagram" ${MERMAID_SOURCE_ATTRIBUTE}="${escapeHtmlAttribute(source)}"` +
    ' aria-busy="true"></div>'
  );
}

/** The language is the first word of the fence info string. */
function fenceLanguage(info: string): string {
  return info.trim().split(/\s+/u, 1)[0] ?? '';
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
