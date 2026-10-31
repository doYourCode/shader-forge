import { describe, expect, it } from 'vitest';

import { ContentResolver, type ContentSource } from './ContentResolver';
import { DEFAULT_LOCALE } from './locales';

const EN_PUBLISHED = `---
title: The Rendering Pipeline
description: From vertices to pixels.
section: basics
order: 1
draft: false
---

English body.
`;

const PT_PUBLISHED = `---
title: O Pipeline de Renderização
description: Dos vértices aos pixels.
section: basics
order: 1
draft: false
---

Corpo em português.
`;

const PT_STUB = `---
title: O Pipeline de Renderização
description: Dos vértices aos pixels.
section: basics
order: 1
draft: true
---

<!-- TODO(pt-BR): translate -->
`;

function source(entries: ContentSource): ContentSource {
  return entries;
}

describe('ContentResolver.resolve', () => {
  it('returns the requested locale when a published translation exists', async () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({
        'en/docs/pipeline.md': EN_PUBLISHED,
        'pt-BR/docs/pipeline.md': PT_PUBLISHED,
      }),
    );

    const result = await resolver.resolve('docs/pipeline.md', 'pt-BR');

    expect(result.content?.title).toBe('O Pipeline de Renderização');
    expect(result.content?.body).toContain('Corpo em português.');
    expect(result.locale).toBe('pt-BR');
    expect(result.isFallback).toBe(false);
  });

  it('falls back to English and reports isFallback when the locale has no file', async () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({ 'en/docs/pipeline.md': EN_PUBLISHED }),
    );

    const result = await resolver.resolve('docs/pipeline.md', 'pt-BR');

    expect(result.content?.title).toBe('The Rendering Pipeline');
    expect(result.content?.body).toContain('English body.');
    expect(result.locale).toBe('en');
    expect(result.isFallback).toBe(true);
  });

  it('treats an unpublished (draft) translation as untranslated and falls back', async () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({
        'en/docs/pipeline.md': EN_PUBLISHED,
        'pt-BR/docs/pipeline.md': PT_STUB,
      }),
    );

    const result = await resolver.resolve('docs/pipeline.md', 'pt-BR');

    expect(result.content?.body).toContain('English body.');
    expect(result.locale).toBe('en');
    expect(result.isFallback).toBe(true);
  });

  it('returns a miss when the path exists in neither locale', async () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({ 'en/docs/pipeline.md': EN_PUBLISHED }),
    );

    const result = await resolver.resolve('docs/does-not-exist.md', 'pt-BR');

    expect(result).toEqual({ content: null, locale: null, isFallback: false });
  });

  it('does not fall back the other way when the default locale is missing', async () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({ 'pt-BR/docs/pipeline.md': PT_PUBLISHED }),
    );

    const result = await resolver.resolve('docs/pipeline.md', 'en');

    expect(result.content).toBeNull();
  });

  it('treats an unknown locale code as the default locale', async () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({ 'en/docs/pipeline.md': EN_PUBLISHED }),
    );

    const result = await resolver.resolve('docs/pipeline.md', 'fr-CA');

    expect(result.content?.title).toBe('The Rendering Pipeline');
    expect(result.locale).toBe('en');
    expect(result.isFallback).toBe(false);
  });

  it('never serves default-locale drafts unless includeDrafts is enabled', async () => {
    const entries = source({
      'en/docs/notes.md': EN_PUBLISHED.replace('draft: false', 'draft: true'),
    });

    const production = new ContentResolver(DEFAULT_LOCALE, entries);
    const development = new ContentResolver(DEFAULT_LOCALE, entries, {
      includeDrafts: true,
    });

    expect((await production.resolve('docs/notes.md', 'en')).content).toBeNull();
    expect(
      (await development.resolve('docs/notes.md', 'en')).content?.title,
    ).toBe('The Rendering Pipeline');
  });

  it('parses structural frontmatter fields', async () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({ 'en/docs/pipeline.md': EN_PUBLISHED }),
    );

    const result = await resolver.resolve('docs/pipeline.md', 'en');
    const doc = result.content;

    expect(doc?.section).toBe('basics');
    expect(doc?.order).toBe(1);
    expect(doc?.draft).toBe(false);
    expect(doc?.relativePath).toBe('docs/pipeline.md');
    expect(doc?.sourcePath).toBe('en/docs/pipeline.md');
  });

  it('rejects traversal segments instead of resolving them', async () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({ 'en/docs/pipeline.md': EN_PUBLISHED }),
    );

    const result = await resolver.resolve('../en/docs/pipeline.md', 'en');

    expect(result.content).toBeNull();
  });
});

describe('ContentResolver.hasTranslation', () => {
  it('is true only for a published document in the exact locale', async () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({
        'en/docs/pipeline.md': EN_PUBLISHED,
        'pt-BR/docs/pipeline.md': PT_PUBLISHED,
      }),
    );

    await expect(
      resolver.hasTranslation('docs/pipeline.md', 'pt-BR'),
    ).resolves.toBe(true);
    await expect(
      resolver.hasTranslation('docs/pipeline.md', 'en'),
    ).resolves.toBe(true);
  });

  it('is false when the locale only has a draft stub', async () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({
        'en/docs/pipeline.md': EN_PUBLISHED,
        'pt-BR/docs/pipeline.md': PT_STUB,
      }),
    );

    await expect(
      resolver.hasTranslation('docs/pipeline.md', 'pt-BR'),
    ).resolves.toBe(false);
  });

  it('is false when the path is absent', async () => {
    const resolver = new ContentResolver(DEFAULT_LOCALE, source({}));

    await expect(
      resolver.hasTranslation('docs/pipeline.md', 'pt-BR'),
    ).resolves.toBe(false);
  });
});

describe('ContentResolver.relativePaths', () => {
  it('returns the union of both locale trees, deduplicated and filtered by kind', () => {
    const resolver = new ContentResolver(
      DEFAULT_LOCALE,
      source({
        'en/docs/pipeline.md': EN_PUBLISHED,
        'pt-BR/docs/pipeline.md': PT_PUBLISHED,
        'en/docs/editor.md': EN_PUBLISHED,
        'en/knowledge/gpu.md': EN_PUBLISHED,
        'pt-BR/knowledge/gpu.md': PT_PUBLISHED,
      }),
    );

    expect(resolver.relativePaths('docs')).toEqual([
      'docs/editor.md',
      'docs/pipeline.md',
    ]);
    expect(resolver.relativePaths('knowledge')).toEqual([
      'knowledge/gpu.md',
    ]);
  });
});
