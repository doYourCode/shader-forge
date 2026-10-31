import { describe, expect, it } from 'vitest';

import { ContentResolver } from './ContentResolver';
import { buildContentTree } from './contentTrees';
import { loadContentSource } from './contentSource';
import { DEFAULT_LOCALE } from './locales';

/**
 * Exercises the real Vite `import.meta.glob` loader and the migrated content
 * trees. Production semantics (drafts unpublished) are used on purpose: the
 * pt-BR stubs are `draft: true` and must therefore fall back to English.
 */
const source = loadContentSource();
const resolver = new ContentResolver(DEFAULT_LOCALE, source);

describe('migrated content trees', () => {
  it('loads every locale from content/<locale>/**', () => {
    const paths = resolver.relativePaths();

    expect(Object.keys(source)).toContain('pt-BR/docs/shader-editor.md');
    expect(paths).toContain('docs/shader-editor.md');
    expect(paths).toContain('knowledge/the-rendering-pipeline.md');
    expect(paths).toContain('knowledge/wgsl-webgpu.md');
  });

  it('serves the English original for an untranslated pt-BR page', async () => {
    const result = await resolver.resolve('docs/shader-editor.md', 'pt-BR');

    expect(result.content).not.toBeNull();
    expect(result.locale).toBe('en');
    expect(result.isFallback).toBe(true);
    expect(await resolver.hasTranslation('docs/shader-editor.md', 'pt-BR')).toBe(
      false,
    );
  });

  it('renders a 404-worthy miss for a slug absent from both trees', async () => {
    const result = await resolver.resolve('docs/not-a-real-page.md', 'pt-BR');

    expect(result.content).toBeNull();
  });

  it('builds a pt-BR tree from fallback content without dropping documents', async () => {
    const tree = await buildContentTree(resolver, 'docs', 'pt-BR');
    const labels = tree.flatMap((section) =>
      (section.children ?? []).map((child) => child.label),
    );

    expect(labels).toContain('ShaderEditor');
  });

  it('keeps section labels localised', async () => {
    const [tree] = await buildContentTree(resolver, 'docs', 'pt-BR');

    expect(tree?.label).toBe('Referência da API');
  });
});
