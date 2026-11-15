import { describe, expect, it } from 'vitest';

import { findShaderExample, shaderExamples } from './shaderExamples';

/**
 * The bindings the preview material already registers. Kept as literals because
 * importing `MaterialController` would pull Babylon into a pure data test; it
 * mirrors `SHADER_ATTRIBUTES`, `SHADER_UNIFORMS` and `SHADER_SAMPLERS` there,
 * and exists to prove the examples never introduce a new one.
 */
const BOUND_ATTRIBUTES = [
  'position',
  'normal',
  'tangent',
  'uv',
  'uv2',
  'color',
];

const BOUND_UNIFORMS = [
  'world',
  'view',
  'projection',
  'time',
  'cameraPos',
  'lightDir',
  'normalMatrix',
  'environmentMap',
  'irradianceMap',
  'prefilteredEnvironmentMap',
  'brdfLUT',
];

/** `?raw` eager glob: the filesystem is the authority on which files exist. */
const EXAMPLE_FILES = import.meta.glob('/src/assets/examples/*.{vert,frag}', {
  query: '?raw',
  eager: true,
  import: 'default',
});

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

  it('pairs every example with its own .vert and .frag file', () => {
    const bundled = Object.keys(EXAMPLE_FILES);
    const claimed = shaderExamples.flatMap((example) => [
      `/src/assets/examples/${example.id}.vert`,
      `/src/assets/examples/${example.id}.frag`,
    ]);

    // Both directions: no dead record and no orphan file in the folder.
    expect(new Set(bundled)).toEqual(new Set(claimed));
    expect(bundled).toHaveLength(claimed.length);
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
