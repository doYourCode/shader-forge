import { describe, expect, it } from 'vitest';

import { ContentResolver } from '@/core/content/ContentResolver';
import { buildContentTree } from '@/core/content/contentTrees';
import { DEFAULT_LOCALE } from '@/core/content/locales';
import { loadContentSource } from './contentSource';

/**
 * Exercises the real Vite `import.meta.glob` loader and the migrated content
 * trees. Production semantics (drafts unpublished) are used on purpose: draft
 * pages stay out of the trees and resolve to nothing.
 */
const source = loadContentSource();
const resolver = new ContentResolver(DEFAULT_LOCALE, source);

function treeLabels(
  tree: Awaited<ReturnType<typeof buildContentTree>>,
): string[] {
  return tree.flatMap((section) =>
    (section.children ?? []).map((child) => child.label),
  );
}

describe('migrated content trees', () => {
  it('loads every locale from content/<locale>/**', () => {
    const paths = resolver.relativePaths();

    expect(Object.keys(source)).toContain('pt-BR/docs/editors-overview.md');
    expect(paths).toContain('docs/editors-overview.md');
    expect(paths).toContain('docs/the-rendering-pipeline.md');
  });

  it('serves a published pt-BR translation without fallback', async () => {
    const result = await resolver.resolve('docs/editors-overview.md', 'pt-BR');

    expect(result.content?.title).toBe('Visão geral dos editores');
    expect(result.locale).toBe('pt-BR');
    expect(result.isFallback).toBe(false);
    expect(
      await resolver.hasTranslation('docs/editors-overview.md', 'pt-BR'),
    ).toBe(true);
  });

  it('serves the published pt-BR translation of the rendering pipeline', async () => {
    const result = await resolver.resolve(
      'docs/the-rendering-pipeline.md',
      'pt-BR',
    );

    expect(result.content?.title).toBe('O pipeline de renderização');
    expect(result.locale).toBe('pt-BR');
    expect(result.isFallback).toBe(false);
    expect(
      await resolver.hasTranslation(
        'docs/the-rendering-pipeline.md',
        'pt-BR',
      ),
    ).toBe(true);
  });

  it('renders a 404-worthy miss for a slug absent from both trees', async () => {
    const result = await resolver.resolve('docs/not-a-real-page.md', 'pt-BR');

    expect(result.content).toBeNull();
  });

  it('builds one tree through the resolver, translated where available', async () => {
    const tree = await buildContentTree(resolver, 'docs', 'pt-BR');

    expect(treeLabels(tree)).toContain('Visão geral dos editores');
    expect(treeLabels(tree)).toContain('O pipeline de renderização');
  });

  it('publishes the English editor documentation set in order', async () => {
    const tree = await buildContentTree(resolver, 'docs', DEFAULT_LOCALE);
    const labels = treeLabels(tree);

    expect(tree[0]?.label).toBe('Editors');
    expect(tree[0]?.children?.[0]?.label).toBe('Editors Overview');
    expect(labels).toEqual(
      expect.arrayContaining([
        'Editors Overview',
        '3D Shader Editor',
        '2D Sandbox',
        'User data',
        'Post effects',
        'Compiling and errors',
        'Limits and troubleshooting',
      ]),
    );
  });

  it('groups the learning pages into their docs sections', async () => {
    const tree = await buildContentTree(resolver, 'docs', DEFAULT_LOCALE);

    expect(tree.map((section) => section.label)).toEqual([
      'Editors',
      'Shader Fundamentals',
      'Tutorials',
      'Lighting',
      'Debugging & Performance',
      'Reference',
    ]);

    const fundamentals = tree.find(
      (section) => section.label === 'Shader Fundamentals',
    );
    const lighting = tree.find((section) => section.label === 'Lighting');

    expect(fundamentals?.children?.[0]?.label).toBe('The Rendering Pipeline');
    expect(lighting?.children?.map((child) => child.label)).toEqual(
      expect.arrayContaining(['Lighting: Lambert', 'Lighting: Cook-Torrance']),
    );
  });

  it('keeps section labels localised and starts with the editor docs', async () => {
    const tree = await buildContentTree(resolver, 'docs', 'pt-BR');
    const labels = tree.map((section) => section.label);

    expect(labels).toEqual([
      'Editores',
      'Fundamentos de Shader',
      'Tutoriais',
      'Iluminação',
      'Depuração e Desempenho',
      'Referência',
    ]);
  });
});
