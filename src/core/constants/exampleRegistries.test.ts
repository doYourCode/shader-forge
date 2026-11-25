import { describe, expect, it } from 'vitest';

import { findSandboxExample, sandboxExamples } from './sandboxExamples';
import {
  findScreenSpaceExample,
  screenSpaceExamples,
} from './screenSpaceExamples';
import {
  findPostEffectExample,
  postEffectExamples,
} from './postEffectExamples';

function uniqueIds(entries: readonly { id: string }[]): boolean {
  return new Set(entries.map((entry) => entry.id)).size === entries.length;
}

describe('sandbox examples', () => {
  it('has unique, non-empty records', () => {
    expect(uniqueIds(sandboxExamples)).toBe(true);

    for (const example of sandboxExamples) {
      expect(example.label.trim().length).toBeGreaterThan(0);
      expect(example.description.trim().length).toBeGreaterThan(0);
      expect(example.fragment.startsWith('#version 300 es')).toBe(true);
      expect(example.fragment).toContain('in vec2 vUv;');
      expect(example.fragment).toContain('uniform vec2 uResolution;');
      expect(example.fragment).toContain('uniform float uTime;');
      expect(example.fragment).toContain('out vec4 fragColor;');
    }
  });

  it('resolves by id and rejects unknown ids', () => {
    for (const example of sandboxExamples) {
      expect(findSandboxExample(example.id)).toBe(example);
    }
    expect(findSandboxExample('nope')).toBeUndefined();
  });

  it('exposes the teaching path documented by the lessons', () => {
    expect(sandboxExamples.map((example) => example.id)).toEqual([
      'uv',
      'gradient',
      'pattern',
      'noise',
      'sdf',
    ]);
  });
});

describe('screen-space examples', () => {
  it('has unique, GLSL ES 3.00 fragments with an explicit output', () => {
    expect(uniqueIds(screenSpaceExamples)).toBe(true);

    for (const example of screenSpaceExamples) {
      expect(example.fragment.startsWith('#version 300 es')).toBe(true);
      expect(example.fragment).toContain(
        'layout(location = 0) out vec4 fragColor;',
      );
      expect(example.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('resolves by id', () => {
    for (const example of screenSpaceExamples) {
      expect(findScreenSpaceExample(example.id)).toBe(example);
    }
    expect(findScreenSpaceExample('nope')).toBeUndefined();
  });
});

describe('post-effect examples', () => {
  it('has unique, GLSL ES 3.00 fragments with an explicit output', () => {
    expect(uniqueIds(postEffectExamples)).toBe(true);

    for (const example of postEffectExamples) {
      expect(example.fragment.startsWith('#version 300 es')).toBe(true);
      expect(example.fragment).toContain(
        'layout(location = 0) out vec4 fragColor;',
      );
      expect(example.fragment).toContain('in vec2 vUV;');
    }
  });

  it('resolves by id', () => {
    for (const example of postEffectExamples) {
      expect(findPostEffectExample(example.id)).toBe(example);
    }
    expect(findPostEffectExample('nope')).toBeUndefined();
  });
});
