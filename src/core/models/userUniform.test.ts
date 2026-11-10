import { describe, expect, it } from 'vitest';

import {
  createEmptyUserDataDocument,
  GLSL_RESERVED_WORDS,
  hasTextureContent,
  isSamplerKind,
  isTextureSource,
  isValueForKind,
  UNIFORM_NAME_PATTERN,
  validateUniformName,
  type UserUniformKind,
  type UserUniformValue,
} from '@/core/models/userUniform';
import {
  defaultUniformValue,
  USER_UNIFORM_KINDS,
  USER_UNIFORM_KIND_MAP,
} from '@/core/constants/userUniformKinds';

const NO_TAKEN = new Set<string>();
const RESERVED = new Set<string>(['time', 'world', ...GLSL_RESERVED_WORDS]);

describe('validateUniformName', () => {
  it('accepts a GLSL identifier that is neither taken nor reserved', () => {
    expect(validateUniformName('tintColor', NO_TAKEN, RESERVED)).toEqual({
      ok: true,
    });
    expect(validateUniformName('_a1', NO_TAKEN, RESERVED)).toEqual({ ok: true });
  });

  it('rejects names that do not match the identifier grammar', () => {
    for (const name of ['', '1abc', 'has space', 'a-b', 'é', 'a.b']) {
      expect(validateUniformName(name, NO_TAKEN, RESERVED)).toEqual({
        ok: false,
        reason: 'invalid',
      });
    }
  });

  it('rejects GLSL reserved words and built-in uniforms', () => {
    expect(validateUniformName('uniform', NO_TAKEN, RESERVED)).toEqual({
      ok: false,
      reason: 'reserved',
    });
    expect(validateUniformName('time', NO_TAKEN, RESERVED)).toEqual({
      ok: false,
      reason: 'reserved',
    });
  });

  it('rejects duplicates from the names passed in', () => {
    expect(validateUniformName('tint', new Set(['tint']), RESERVED)).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });

  it('keeps the grammar anchored and case-sensitive', () => {
    expect(UNIFORM_NAME_PATTERN.test('Time')).toBe(true);
    expect(RESERVED.has('Time')).toBe(false);
  });
});

describe('user data document', () => {
  it('starts empty with a zero revision', () => {
    expect(createEmptyUserDataDocument()).toEqual({
      revision: 0,
      definitions: [],
    });
  });

  it('gives every definition a fresh default value', () => {
    for (const meta of USER_UNIFORM_KINDS) {
      const first = defaultUniformValue(meta.kind);
      const second = defaultUniformValue(meta.kind);

      expect(first).toEqual(second);
      if (typeof first === 'object') {
        expect(first).not.toBe(second);
      }
    }
  });

  it('describes every kind exactly once', () => {
    const kinds = USER_UNIFORM_KINDS.map((meta) => meta.kind);
    const expected: UserUniformKind[] = [
      'float',
      'vec2',
      'vec3',
      'vec4',
      'color',
      'color4',
      'direction',
      'position',
      'sampler2D',
      'samplerCube',
    ];

    expect(kinds).toEqual(expected);
    expect(Object.keys(USER_UNIFORM_KIND_MAP)).toHaveLength(expected.length);
  });

  it('uses the GLSL types the shader needs', () => {
    const types = Object.fromEntries(
      USER_UNIFORM_KINDS.map((meta) => [meta.kind, meta.glslType]),
    );

    expect(types.color).toBe('vec3');
    expect(types.color4).toBe('vec4');
    expect(types.direction).toBe('vec3');
    expect(types.position).toBe('vec3');
    expect(types.sampler2D).toBe('sampler2D');
    expect(types.samplerCube).toBe('samplerCube');
  });
});

describe('uniform values', () => {
  it('recognises the sampler kinds', () => {
    expect(isSamplerKind('sampler2D')).toBe(true);
    expect(isSamplerKind('samplerCube')).toBe(true);
    expect(isSamplerKind('color')).toBe(false);
  });

  it('validates value shapes per kind', () => {
    expect(isValueForKind('float', 1.5)).toBe(true);
    expect(isValueForKind('float', Number.NaN)).toBe(false);
    expect(isValueForKind('vec3', { x: 0, y: 1, z: 2 })).toBe(true);
    expect(
      isValueForKind('vec3', { x: 0, y: 1 } as unknown as UserUniformValue),
    ).toBe(false);
    expect(isValueForKind('color', { r: 0, g: 0, b: 0 })).toBe(true);
    expect(isValueForKind('color4', { r: 0, g: 0, b: 0, a: 1 })).toBe(true);
    expect(isValueForKind('sampler2D', { kind: 'url', url: '/a.png' })).toBe(
      true,
    );
    expect(
      isValueForKind('sampler2D', { kind: 'url' } as unknown as UserUniformValue),
    ).toBe(false);
    expect(
      isValueForKind('sampler2D', {
        kind: 'repository',
        textureId: 'uv-checker-01',
      }),
    ).toBe(true);
  });

  it('narrows repository texture sources', () => {
    expect(
      isTextureSource({ kind: 'repository', textureId: 'uv-checker-01' }),
    ).toBe(true);
    expect(
      isTextureSource({
        kind: 'repository',
        textureId: 1,
      } as unknown as UserUniformValue),
    ).toBe(false);
    expect(
      isTextureSource({ kind: 'unknown' } as unknown as UserUniformValue),
    ).toBe(false);
  });

  it('treats empty texture sources as unset', () => {
    expect(hasTextureContent({ kind: 'url', url: '' })).toBe(false);
    expect(hasTextureContent({ kind: 'url', url: '  ' })).toBe(false);
    expect(hasTextureContent({ kind: 'url', url: '/a.png' })).toBe(true);
    expect(
      hasTextureContent({ kind: 'repository', textureId: 'uv-checker-01' }),
    ).toBe(true);
    expect(hasTextureContent({ kind: 'repository', textureId: '' })).toBe(false);
    expect(
      hasTextureContent({ kind: 'repository', textureId: '   ' }),
    ).toBe(false);
  });
});
