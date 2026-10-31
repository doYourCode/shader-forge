import { describe, expect, it } from 'vitest';

import { renderMarkdown } from './markdown';

describe('renderMarkdown Mermaid support', () => {
  it('turns a mermaid fence into an inert render placeholder', () => {
    const html = renderMarkdown('```mermaid\ngraph TD;\n  A --> B;\n```');

    expect(html).toContain('class="mermaid-diagram"');
    expect(html).toContain('data-mermaid-source="graph TD;');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('<pre>');
  });

  it('escapes the diagram source so it cannot break out of the attribute', () => {
    const html = renderMarkdown(
      '```mermaid\ngraph TD; A["<b>quoted</b>"] --> B;\n```',
    );

    expect(html).toContain('&quot;');
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
  });

  it('ignores the info-string suffixes editors may add', () => {
    const html = renderMarkdown('```mermaid title="Pipeline"\ngraph TD;\n```');

    expect(html).toContain('class="mermaid-diagram"');
  });

  it('leaves other fenced code blocks untouched', () => {
    const html = renderMarkdown('```ts\nconst answer = 42;\n```');

    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).not.toContain('mermaid-diagram');
  });

  it('does not treat lookalike language names as mermaid', () => {
    const html = renderMarkdown('```mermaid-ish\nnot a diagram\n```');

    expect(html).toContain('language-mermaid-ish');
    expect(html).not.toContain('mermaid-diagram');
  });
});
