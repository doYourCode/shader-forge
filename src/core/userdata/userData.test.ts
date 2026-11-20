import { describe, expect, it } from 'vitest';

import type { ShaderSource } from '@/core/models/shaderSource';
import type { UserDataDocument } from '@/core/models/userUniform';
import { buildUserDataBlueprint, validateUserDataName } from './userData';

const DOCUMENT: UserDataDocument = {
  revision: 2,
  definitions: [
    {
      id: 'user-1',
      name: 'tint',
      kind: 'color',
      stages: 'fragment',
      value: { r: 1, g: 1, b: 1 },
    },
    {
      id: 'user-2',
      name: 'albedo',
      kind: 'sampler2D',
      stages: 'fragment',
      value: { kind: 'url', url: '/albedo.png' },
    },
  ],
};

const SOURCES: ShaderSource = {
  vertex: `#version 300 es
precision highp float;
void main() {}`,
  fragment: `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(1.0);
}`,
};

describe('validateUserDataName', () => {
  it('rejects invalid, reserved and duplicate identifiers', () => {
    expect(validateUserDataName(DOCUMENT, '1bad')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(validateUserDataName(DOCUMENT, 'uniform')).toEqual({
      ok: false,
      reason: 'reserved',
    });
    expect(validateUserDataName(DOCUMENT, 'time')).toEqual({
      ok: false,
      reason: 'reserved',
    });
    expect(validateUserDataName(DOCUMENT, 'tint')).toEqual({
      ok: false,
      reason: 'duplicate',
    });
  });

  it('lets a renamed definition keep its own name', () => {
    expect(validateUserDataName(DOCUMENT, 'tint', 'user-1')).toEqual({
      ok: true,
    });
  });

  it('accepts a fresh identifier', () => {
    expect(validateUserDataName(DOCUMENT, 'accent')).toEqual({ ok: true });
  });
});

describe('buildUserDataBlueprint', () => {
  it('assembles the generated block and the material extras', () => {
    const blueprint = buildUserDataBlueprint(DOCUMENT, SOURCES);

    expect(blueprint.fragment).toContain('uniform vec3 tint; // color (RGB)');
    expect(blueprint.fragment).toContain(
      'uniform sampler2D albedo; // texture 2D',
    );
    expect(blueprint.fragment).toContain('tint = (1, 1, 1)');
    expect(blueprint.extraUniforms).toEqual(['tint']);
    expect(blueprint.extraSamplers).toEqual(['albedo']);
    // No vertex definition, so that stage is handed through untouched.
    expect(blueprint.vertex).toBe(SOURCES.vertex);
  });

  it('keeps the authoring sources for diagnostics', () => {
    const blueprint = buildUserDataBlueprint(DOCUMENT, SOURCES);

    expect(blueprint.editorSource).toEqual(SOURCES);
    expect(blueprint.editorSource.fragment).not.toContain('uniform vec3 tint;');
  });

  it('records where the generated block landed', () => {
    const blueprint = buildUserDataBlueprint(DOCUMENT, SOURCES);

    expect(blueprint.userData?.vertex).toBeNull();
    expect(blueprint.userData?.fragment?.injected).not.toBeNull();
    expect(
      blueprint.userData?.fragment?.declarationRowByLine.length,
    ).toBeGreaterThan(0);
  });
});
