import { describe, expect, it } from 'vitest';

import { GLSL_RESERVED_WORDS } from '@/core/constants/glslReservedWords';
import {
  UNIFORM_NAME_PATTERN,
  isValueForKind,
} from '@/core/models/userUniform';
import {
  SHADER_ATTRIBUTES,
  SHADER_SAMPLERS,
  SHADER_UNIFORMS,
} from './materialAbi';
import {
  findShaderExample,
  shaderExampleCatalog,
  shaderExampleGroups,
  shaderExamples,
} from './shaderExamples';

/**
 * The bindings the preview material registers, read straight from the ABI.
 * Importing the ABI (not `MaterialController`) keeps Babylon out of this pure
 * data test, and the examples can never reference a name the material lacks.
 */
const BOUND_ATTRIBUTES = [...SHADER_ATTRIBUTES];

const BOUND_UNIFORMS = [...SHADER_UNIFORMS, ...SHADER_SAMPLERS];

/** `?raw` eager glob: the filesystem is the authority on which files exist. */
const EXAMPLE_FILES = import.meta.glob('/src/assets/examples/*.{vert,frag}', {
  query: '?raw',
  eager: true,
  import: 'default',
});

/** Baked previews; absent until `npm run bake:examples` has run once. */
const EXAMPLE_THUMBNAILS = import.meta.glob(
  '/src/assets/examples/thumbs/*.webp',
  {
    query: '?url&no-inline',
    eager: true,
    import: 'default',
  },
);

function declaredNames(source: string, qualifier: string): string[] {
  const pattern = new RegExp(
    `^[ \\t]*${qualifier}\\s+\\w+\\s+(\\w+)\\s*;`,
    'gm',
  );

  return [...source.matchAll(pattern)].map((match) => match[1]!);
}

describe('shaderExamples', () => {
  it('uses unique ids', () => {
    const ids = shaderExamples.map((example) => example.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every example an id, label, description, group and stages', () => {
    for (const example of shaderExamples) {
      expect(example.id.trim().length).toBeGreaterThan(0);
      expect(example.label.trim().length).toBeGreaterThan(0);
      expect(example.description.trim().length).toBeGreaterThan(0);
      expect(example.group.trim().length).toBeGreaterThan(0);
      expect(example.vertex.trim().length).toBeGreaterThan(0);
      expect(example.fragment.trim().length).toBeGreaterThan(0);
      expect(example.uniforms.length).toBeGreaterThan(0);
    }
  });

  it('starts every stage with the GLSL ES 3.00 version header', () => {
    for (const example of shaderExamples) {
      expect(example.vertex.startsWith('#version 300 es')).toBe(true);
      expect(example.fragment.startsWith('#version 300 es')).toBe(true);
    }
  });

  it('lists every example under a non-empty group', () => {
    for (const example of shaderExamples) {
      expect(example.group.trim().length).toBeGreaterThan(0);
    }
  });

  it('only binds attributes and uniforms the preview already provides', () => {
    for (const example of shaderExamples) {
      for (const name of declaredNames(example.vertex, 'in')) {
        expect(BOUND_ATTRIBUTES, `${example.id}: attribute ${name}`).toContain(
          name,
        );
      }

      for (const source of [example.vertex, example.fragment]) {
        for (const name of declaredNames(source, 'uniform')) {
          expect(BOUND_UNIFORMS, `${example.id}: uniform ${name}`).toContain(
            name,
          );
        }
      }
    }
  });

  it('exposes seedable, referenced and undeclared user uniforms', () => {
    for (const example of shaderExamples) {
      const names = example.uniforms.map((uniform) => uniform.name);
      expect(new Set(names).size).toBe(names.length);

      const declared = new Set([
        ...declaredNames(example.vertex, 'uniform'),
        ...declaredNames(example.fragment, 'uniform'),
      ]);
      const source = `${example.vertex}\n${example.fragment}`;

      for (const uniform of example.uniforms) {
        // The same rules the User data tab enforces before it accepts a row.
        expect(UNIFORM_NAME_PATTERN.test(uniform.name)).toBe(true);
        expect(GLSL_RESERVED_WORDS).not.toContain(uniform.name);
        expect(BOUND_ATTRIBUTES).not.toContain(uniform.name);
        expect(BOUND_UNIFORMS).not.toContain(uniform.name);

        expect(isValueForKind(uniform.kind, uniform.value)).toBe(true);

        // The generated block declares it, so the example must only use it.
        expect(declared.has(uniform.name)).toBe(false);
        expect(new RegExp(`\\b${uniform.name}\\b`).test(source)).toBe(true);
      }
    }
  });

  it('pairs every example with the stage files it claims', () => {
    const files = EXAMPLE_FILES as Readonly<Record<string, string>>;
    const vertexSources = new Set(
      Object.entries(files)
        .filter(([path]) => path.endsWith('.vert'))
        .map(([, source]) => source),
    );

    for (const example of shaderExamples) {
      // The fragment stage is per example and named after its id.
      expect(files[`/src/assets/examples/${example.id}.frag`]).toBe(
        example.fragment,
      );
      // Vertex stages may be shared helpers (basiclm-common, ibl-common).
      expect(vertexSources).toContain(example.vertex);
    }

    // No orphan file: every bundled source belongs to some example.
    const claimed = new Set(
      shaderExamples.flatMap((example) => [example.vertex, example.fragment]),
    );
    for (const [path, source] of Object.entries(files)) {
      expect(claimed, `${path} is not used by any example`).toContain(source);
    }
  });

  it('groups examples into one folder per authored section', () => {
    expect(shaderExampleGroups.map((group) => group.label)).toEqual([
      'Lighting',
      'Image-based lighting',
    ]);

    expect(shaderExampleGroups.flatMap((group) => group.examples)).toEqual([
      ...shaderExamples,
    ]);

    for (const group of shaderExampleGroups) {
      expect(group.id).toMatch(/^[a-z0-9-]+$/);
      expect(group.examples.length).toBeGreaterThan(0);
      expect(
        group.examples.every((example) => example.group === group.label),
      ).toBe(true);
    }

    const ids = shaderExampleGroups.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes every example through the catalog and its groups', () => {
    expect(shaderExampleCatalog.all).toEqual([...shaderExamples]);

    for (const group of shaderExampleGroups) {
      for (const example of group.examples) {
        expect(shaderExampleCatalog.find(example.id)).toBe(example);
      }
    }

    expect(shaderExampleCatalog.find('nope')).toBeUndefined();
  });

  it('bakes either every example thumbnail or none of them', () => {
    const baked = shaderExamples.filter(
      (example) => example.thumbnailUrl !== undefined,
    );

    expect([0, shaderExamples.length]).toContain(baked.length);
  });

  it('maps every baked thumbnail to its example and claims every file', () => {
    const bundled = Object.keys(EXAMPLE_THUMBNAILS);
    const claimed = shaderExamples
      .filter((example) => example.thumbnailUrl !== undefined)
      .map((example) => `/src/assets/examples/thumbs/${example.id}.webp`);

    // Both directions: no dead record and no orphan thumbnail on disk.
    expect(new Set(claimed)).toEqual(new Set(bundled));
  });

  it('resolves examples by id', () => {
    for (const example of shaderExamples) {
      expect(findShaderExample(example.id)).toBe(example);
    }

    expect(findShaderExample('nope')).toBeUndefined();
  });

  it('has a stable id contract', () => {
    // Ids are the file names, so they are a compatibility contract.
    expect(shaderExamples.map((example) => example.id)).toMatchInlineSnapshot(`
      [
        "lambert",
        "phong",
        "blinn-phong",
        "oren-nayar",
        "cook-torrance",
        "ibl-metalness-roughness",
        "ibl-specular-glossiness",
      ]
    `);
  });
});
