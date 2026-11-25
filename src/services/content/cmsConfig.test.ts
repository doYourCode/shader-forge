/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { contentSectionIds } from '@/core/content/contentTrees';
import { loadContentSource } from './contentSource';
import { parseFrontmatter } from '@/core/content/frontmatter';

/**
 * Pages CMS is the editing surface for every content page. A frontmatter key
 * that the runtime reads but `.pages.yml` does not declare is invisible to
 * editors, so this test treats the CMS schema as part of the content contract.
 */

interface CmsField {
  readonly name?: string;
  readonly options?: { readonly values?: readonly { readonly name?: string }[] };
}

interface CmsCollection {
  readonly name?: string;
  readonly path?: string;
  readonly fields?: readonly CmsField[];
}

interface CmsConfig {
  readonly content?: readonly CmsCollection[];
}

const config = parseYaml(
  readFileSync(new URL('../../../.pages.yml', import.meta.url), 'utf8'),
) as CmsConfig;

const collections = config.content ?? [];

const source = loadContentSource();

const FRONTMATTER_KEYS = new Set<string>();
for (const [key, raw] of Object.entries(source)) {
  if (!key.startsWith('en/')) continue;
  const { data } = parseFrontmatter<Record<string, unknown>>(raw);
  for (const name of Object.keys(data)) FRONTMATTER_KEYS.add(name);
}

function collectionFor(locale: 'en' | 'pt-BR'): CmsCollection {
  const collection = collections.find((candidate) =>
    candidate.path?.includes(`/${locale}/docs`),
  );
  if (!collection) {
    throw new Error(`No ${locale} CMS collection for the docs tree.`);
  }
  return collection;
}

function field(collection: CmsCollection, name: string): CmsField | undefined {
  return (collection.fields ?? []).find((candidate) => candidate.name === name);
}

function optionNames(fieldValue: CmsField | undefined): string[] {
  return (fieldValue?.options?.values ?? [])
    .map((option) => option.name)
    .filter((name): name is string => typeof name === 'string');
}

describe('Pages CMS schema', () => {
  it('declares every frontmatter key the runtime reads', () => {
    const collection = collectionFor('en');

    for (const key of FRONTMATTER_KEYS) {
      expect(
        field(collection, key),
        `docs collection is missing the "${key}" field`,
      ).toBeDefined();
    }
  });

  it('offers exactly the sections the navigation declares', () => {
    const collection = collectionFor('en');
    const section = field(collection, 'section');

    expect(optionNames(section).sort()).toEqual(
      [...contentSectionIds('docs')].sort(),
    );
  });

  it('offers the difficulty and editor values the runtime parses', () => {
    const docs = collectionFor('en');

    expect(optionNames(field(docs, 'difficulty')).sort()).toEqual([
      'advanced',
      'beginner',
      'intermediate',
    ]);

    expect(optionNames(field(docs, 'editor')).sort()).toEqual([
      'editor',
      'sandbox',
      'screen-space',
    ]);
  });

  it('keeps the translated collections structurally identical', () => {
    const english = collectionFor('en');
    const portuguese = collectionFor('pt-BR');

    const englishFields = (english.fields ?? []).map((item) => item.name);
    const portugueseFields = (portuguese.fields ?? []).map((item) => item.name);

    expect(portugueseFields).toEqual(englishFields);
  });
});
