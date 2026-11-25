import { describe, expect, it } from 'vitest';

import { loadContentSource } from './contentSource';
import { parseFrontmatter } from '@/core/content/frontmatter';
import {
  parseEditor,
  parseStringList,
} from '@/core/content/contentMetadata';
import { contentSectionIds } from '@/core/content/contentTrees';
import {
  editorPath,
  parseEditorQuery,
  type EditorTarget,
} from '@/core/navigation/editorLinks';
import { findShaderExample } from '@/core/constants/shaderExamples';
import { findSandboxExample } from '@/core/constants/sandboxExamples';
import { findScreenSpaceExample } from '@/core/constants/screenSpaceExamples';
import { findPostEffectExample } from '@/core/constants/postEffectExamples';

const source = loadContentSource();

interface RawDoc {
  readonly key: string;
  readonly relativePath: string;
  readonly slug: string;
  readonly body: string;
  readonly data: {
    title?: unknown;
    section?: unknown;
    editor?: unknown;
    example?: unknown;
    prerequisites?: unknown;
  };
}

const docs: RawDoc[] = Object.entries(source)
  .filter(([key]) => key.startsWith('en/'))
  .map(([key, raw]) => {
    const relativePath = key.slice('en/'.length);
    const { data, body } = parseFrontmatter<RawDoc['data']>(raw);
    return {
      key,
      relativePath,
      slug: relativePath.split('/').pop()?.replace(/\.md$/i, '') ?? '',
      body,
      data,
    };
  });

const slugs = new Set(docs.map((doc) => doc.slug));

const contentSlugs = new Set(docs.map((doc) => doc.slug));

function fail(message: string): never {
  throw new Error(message);
}

function assertExample(target: EditorTarget, id: string, where: string): void {
  const found =
    target === 'editor'
      ? Boolean(findShaderExample(id))
      : target === 'sandbox'
        ? Boolean(findSandboxExample(id))
        : Boolean(findScreenSpaceExample(id));

  if (!found) fail(`${where}: unknown ${target} example id "${id}"`);
}

describe('lesson authoring contract', () => {
  it('gives every document a known section', () => {
    for (const doc of docs) {
      const sections = contentSectionIds('docs');
      const section = String(doc.data.section ?? '');

      expect(
        sections.includes(section),
        `${doc.key}: section "${section}" is not declared in docs sections`,
      ).toBe(true);
    }
  });

  it('resolves every prerequisite slug', () => {
    for (const doc of docs) {
      for (const prerequisite of parseStringList(doc.data.prerequisites)) {
        expect(
          slugs.has(prerequisite),
          `${doc.key}: prerequisite "${prerequisite}" is not a page slug`,
        ).toBe(true);
      }
    }
  });

  it('resolves every frontmatter editor/example pair', () => {
    for (const doc of docs) {
      const editor = parseEditor(doc.data.editor);
      if (!editor) {
        expect(doc.data.example, `${doc.key}: example without editor`).toBe(
          undefined,
        );
        continue;
      }

      const example =
        typeof doc.data.example === 'string' ? doc.data.example : null;
      expect(example, `${doc.key}: editor without example`).toBeTruthy();
      assertExample(editor, example ?? '', doc.key);
    }
  });

  it('resolves every Open in editor / Run this link', () => {
    const linkPattern =
      /\]\((\/(?:editor|sandbox|screen-space)\?[^)\s]+)\)/g;

    for (const doc of docs) {
      for (const match of doc.body.matchAll(linkPattern)) {
        const href = match[1] ?? '';
        const [path, query = ''] = href.split('?');
        const target = path.replace(/^\//, '');
        if (
          target !== 'editor' &&
          target !== 'sandbox' &&
          target !== 'screen-space'
        ) {
          continue;
        }

        const params = new URLSearchParams(query);
        const example = params.get('example');
        const effect = params.get('effect');
        const code = params.get('code');

        if (example) assertExample(target, example, `${doc.key} ${href}`);
        if (effect) {
          expect(
            findPostEffectExample(effect),
            `${doc.key}: unknown effect id "${effect}"`,
          ).toBeDefined();
        }
        if (!example && !effect) {
          expect(code, `${doc.key}: editor link without a payload`).toBeTruthy();
        }
      }
    }
  });

  it('resolves every internal docs link', () => {
    const linkPattern = /\]\((\/docs\/([a-z0-9-]+))\)/g;

    for (const doc of docs) {
      for (const match of doc.body.matchAll(linkPattern)) {
        const href = match[1] ?? '';
        const slug = match[2] ?? '';

        expect(
          contentSlugs.has(slug),
          `${doc.key}: broken docs link ${href}`,
        ).toBe(true);
      }
    }
  });

  it('resolves every code-fence example/effect modifier', () => {
    const fencePattern = /```[^\n]*\b(?:example|effect)=([^\s]+)[^\n]*\n/g;

    for (const doc of docs) {
      for (const match of doc.body.matchAll(fencePattern)) {
        const modifier = match[0];
        const id = match[1] ?? '';

        if (modifier.includes('effect=')) {
          expect(
            findPostEffectExample(id),
            `${doc.key}: fence effect "${id}"`,
          ).toBeDefined();
        } else {
          const target = modifier.includes('run=sandbox')
            ? 'sandbox'
            : modifier.includes('run=screen-space')
              ? 'screen-space'
              : 'editor';
          assertExample(target, id, `${doc.key} fence`);
        }
      }
    }
  });

  it('ships complete GLSL in every Run this sandbox block', () => {
    const sandboxFence = /```glsl[^\n]*run=sandbox[^\n]*\n([\s\S]*?)```/g;

    for (const doc of docs) {
      for (const match of doc.body.matchAll(sandboxFence)) {
        const code = match[1] ?? '';
        expect(
          code.startsWith('#version 300 es'),
          `${doc.key}: run=sandbox block must start with #version 300 es`,
        ).toBe(true);
        expect(code).toContain('out vec4 fragColor;');
      }
    }
  });

  it('keeps the deep-link builder and parser in sync', () => {
    const url = editorPath({
      target: 'sandbox',
      example: 'gradient',
      code: 'void main() {}',
      tab: 'fragment',
    });

    const query = parseEditorQuery(
      Object.fromEntries(new URLSearchParams(url.split('?')[1] ?? '')),
    );

    expect(query.example).toBe('gradient');
    expect(query.code).toBe('void main() {}');
    expect(query.tab).toBe('fragment');
  });
});
