import { describe, expect, it } from 'vitest';

import type { PostEffectDocument } from '@/core/models/postEffect';
import type { UserDataDocument } from '@/core/models/userUniform';
import { buildPostEffectSource } from './postEffectCodegen';

const EFFECT: PostEffectDocument = {
  id: 'effect-1',
  name: 'Test effect',
  enabled: true,
  fragment: `#version 300 es
precision highp float;

in vec2 vUV;
layout(location = 0) out vec4 fragColor;

void main(void) {
  fragColor = vec4(1.0);
}`,
};

function documentWith(
  definitions: UserDataDocument['definitions'],
): UserDataDocument {
  return { revision: definitions.length, definitions };
}

describe('buildPostEffectSource', () => {
  it('leaves the source untouched when no definition targets post effects', () => {
    const document = documentWith([
      {
        id: 'u1',
        name: 'tint',
        kind: 'color',
        stages: 'fragment',
        value: { r: 1, g: 0, b: 0 },
      },
    ]);

    const source = buildPostEffectSource(document, EFFECT);

    expect(source.fragment).toBe(EFFECT.fragment);
    expect(source.editorSource).toBe(EFFECT.fragment);
    expect(source.injected).toBeNull();
    expect(source.extraUniforms).toEqual([]);
    expect(source.extraSamplers).toEqual([]);
  });

  it('injects the generated block after the shader header', () => {
    const document = documentWith([
      {
        id: 'u1',
        name: 'radius',
        kind: 'float',
        stages: 'post',
        value: 2,
      },
    ]);

    const source = buildPostEffectSource(document, EFFECT);
    const lines = source.fragment.split('\n');

    expect(lines[0]).toBe('#version 300 es');
    expect(lines[1]).toBe('precision highp float;');
    expect(source.injected).not.toBeNull();
    expect(source.fragment).toContain('uniform float radius;');
    expect(source.extraUniforms).toEqual(['radius']);
  });

  it('separates uniform and sampler names and ignores other stages', () => {
    const document = documentWith([
      {
        id: 'u1',
        name: 'radius',
        kind: 'float',
        stages: 'post',
        value: 2,
      },
      {
        id: 'u2',
        name: 'mask',
        kind: 'sampler2D',
        stages: 'post',
        value: { kind: 'url', url: '/mask.png' },
      },
      {
        id: 'u3',
        name: 'albedo',
        kind: 'color',
        stages: 'both',
        value: { r: 1, g: 1, b: 1 },
      },
    ]);

    const source = buildPostEffectSource(document, EFFECT);

    expect(source.extraUniforms).toEqual(['radius']);
    expect(source.extraSamplers).toEqual(['mask']);
    expect(source.fragment).not.toContain('albedo');
  });

  it('records the definition row for every injected declaration line', () => {
    const document = documentWith([
      {
        id: 'u1',
        name: 'radius',
        kind: 'float',
        stages: 'post',
        value: 2,
      },
      {
        id: 'u2',
        name: 'strength',
        kind: 'float',
        stages: 'post',
        value: 1,
      },
    ]);

    const source = buildPostEffectSource(document, EFFECT);

    expect(source.declarationRowByLine).toEqual([-1, 0, 1, -1, -1]);
  });
});
