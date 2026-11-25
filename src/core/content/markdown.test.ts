import { describe, expect, it } from 'vitest';

import {
  extractMarkdownHeadings,
  renderMarkdown,
  renderMarkdownDocument,
} from './markdown';

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

describe('renderMarkdownDocument', () => {
  it('returns heading ids that match the rendered anchors', () => {
    const document = renderMarkdownDocument(
      '# Title\n\n## Concept\n\n### Inline `code`\n\n## Concept\n',
    );

    expect(document.headings.map((heading) => heading.text)).toEqual([
      'Concept',
      'Inline code',
      'Concept',
    ]);

    for (const heading of document.headings) {
      expect(document.html).toContain(`id="${heading.id}"`);
    }

    // Duplicate headings receive a numeric suffix, like the anchor plugin.
    expect(document.headings[0]?.id).not.toBe(document.headings[2]?.id);
  });

  it('extracts headings without rendering the body', () => {
    expect(extractMarkdownHeadings('## One\n\ntext\n\n### Two')[0]?.id).toBe(
      'one',
    );
  });
});

describe('code block toolbar', () => {
  it('always adds Copy and uses the language for syntax highlighting', () => {
    const html = renderMarkdown('```glsl\nvoid main() {}\n```');

    expect(html).toContain('class="code-block"');
    expect(html).toContain('data-code-action="copy"');
    expect(html).toContain('class="language-glsl"');
    expect(html).not.toContain('data-code-action="run"');
  });

  it('adds Run this for a sandbox snippet', () => {
    const html = renderMarkdown(
      '```glsl run=sandbox title="Demo"\n#version 300 es\nvoid main() {}\n```',
    );

    expect(html).toContain('data-code-action="run"');
    expect(html).toContain('data-run-target="sandbox"');
    expect(html).toContain('Run this');
    expect(html).toContain('Demo');
  });

  it('turns example= into an editor deep-link action', () => {
    const html = renderMarkdown('```glsl example=phong\n...\n```');

    expect(html).toContain('data-example="phong"');
    expect(html).toContain('Open in editor');
  });

  it('does not swallow Mermaid fences', () => {
    const html = renderMarkdown('```mermaid\ngraph TD; A --> B;\n```');

    expect(html).toContain('mermaid-diagram');
    expect(html).not.toContain('code-block');
  });
});

describe('lesson containers and glossary', () => {
  it('renders a solution container as a native details element', () => {
    const html = renderMarkdown(
      '::: solution Solution 1\nUse `mix`.\n\n```glsl\nvec3 c = mix(a, b, t);\n```\n:::',
    );

    expect(html).toContain('<details class="solution">');
    expect(html).toContain('<summary>Solution 1</summary>');
    expect(html).toContain('class="language-glsl"');
    expect(html).toContain('</details>');
  });

  it('renders note and warning containers as callouts', () => {
    const html = renderMarkdown(
      '::: note Note\nKeep it linear.\n:::\n\n::: warning Warning\nDo not encode twice.\n:::',
    );

    expect(html).toContain('callout--note');
    expect(html).toContain('callout--warning');
    expect(html).toContain('Keep it linear.');
  });

  it('turns a glossary pair into a hoverable abbr', () => {
    const html = renderMarkdown('The [[MVP|model-view-projection matrix]] is a product.');

    expect(html).toContain('<abbr class="glossary-term"');
    expect(html).toContain('title="model-view-projection matrix"');
    expect(html).toContain('>MVP</abbr>');
  });

  it('escapes a glossary definition so it cannot inject markup', () => {
    const html = renderMarkdown('[[term|"><script>alert(1)</script>]]');

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

