import { describe, expect, it } from 'vitest';

import { ContentResolver } from './ContentResolver';
import { buildContentTree } from './contentTrees';
import { loadContentSource } from './contentSource';
import { DEFAULT_LOCALE } from './locales';

/**
 * Exercises the real Vite `import.meta.glob` loader and the migrated content
 * trees. Production semantics (drafts unpublished) are used on purpose:
 * unpublished pt-BR stubs must fall back to English.
 */
const source = loadContentSource();
const resolver = new ContentResolver(DEFAULT_LOCALE, source);

function treeLabels(tree: Awaited<ReturnType<typeof buildContentTree>>): string[] {
  return tree.flatMap((section) =>
    (section.children ?? []).map((child) => child.label),
  );
}

describe('migrated content trees', () => {
  it('loads every locale from content/<locale>/**', () => {
    const paths = resolver.relativePaths();

    expect(Object.keys(source)).toContain('pt-BR/docs/shader-editor.md');
    expect(paths).toContain('docs/shader-editor.md');
    expect(paths).toContain('knowledge/the-rendering-pipeline.md');
    expect(paths).toContain('knowledge/wgsl-webgpu.md');
  });

  it('serves a published pt-BR translation without fallback', async () => {
    const result = await resolver.resolve('docs/shader-editor.md', 'pt-BR');

    expect(result.content?.title).toBe('Editor de Shader');
    expect(result.locale).toBe('pt-BR');
    expect(result.isFallback).toBe(false);
    expect(await resolver.hasTranslation('docs/shader-editor.md', 'pt-BR')).toBe(
      true,
    );
  });

  it('serves the English original for an untranslated pt-BR page', async () => {
    const result = await resolver.resolve(
      'knowledge/the-rendering-pipeline.md',
      'pt-BR',
    );

    expect(result.content?.title).toBe('The Rendering Pipeline');
    expect(result.locale).toBe('en');
    expect(result.isFallback).toBe(true);
    expect(
      await resolver.hasTranslation(
        'knowledge/the-rendering-pipeline.md',
        'pt-BR',
      ),
    ).toBe(false);
  });

  it('renders a 404-worthy miss for a slug absent from both trees', async () => {
    const result = await resolver.resolve('docs/not-a-real-page.md', 'pt-BR');

    expect(result.content).toBeNull();
  });

  it('builds trees through the resolver, translated where available', async () => {
    const docsTree = await buildContentTree(resolver, 'docs', 'pt-BR');
    const knowledgeTree = await buildContentTree(
      resolver,
      'knowledge',
      'pt-BR',
    );

    expect(treeLabels(docsTree)).toContain('Editor de Shader');
    expect(treeLabels(knowledgeTree)).toContain('The Rendering Pipeline');
  });

  it('keeps section labels localised', async () => {
    const [tree] = await buildContentTree(resolver, 'docs', 'pt-BR');

    expect(tree?.label).toBe('Referência da API');
  });
});
