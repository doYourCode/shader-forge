import { describe, expect, it } from 'vitest';

import defaultVertex from '@/assets/internal-shaders/default.vert.glsl?raw';
import defaultFragment from '@/assets/internal-shaders/default.frag.glsl?raw';
import errorVertex from '@/assets/internal-shaders/error.vert.glsl?raw';
import errorFragment from '@/assets/internal-shaders/error.frag.glsl?raw';
import { SHADER_SAMPLER_NAMES } from '@/services/babylon/preview/MaterialController';
import { internalShaders } from './internalShaders';

const shaders = {
  'default.vert.glsl': defaultVertex,
  'default.frag.glsl': defaultFragment,
  'error.vert.glsl': errorVertex,
  'error.frag.glsl': errorFragment,
} as const;

const GLSL_100_ONLY_TOKENS = /\b(?:attribute|varying|gl_FragColor|texture2D)\b/;

describe('internal shaders', () => {
  for (const [name, source] of Object.entries(shaders)) {
    describe(name, () => {
      it('starts with #version 300 es followed by a default precision', () => {
        const lines = source.replace(/\r/g, '').split('\n');

        expect(lines[0]).toBe('#version 300 es');
        expect(lines[1]).toBe('precision highp float;');
      });

      it('does not use GLSL ES 1.00-only tokens', () => {
        expect(source).not.toMatch(GLSL_100_ONLY_TOKENS);
      });
    });
  }

  it('declares a fragment output in both fragment shaders', () => {
    const output =
      /layout\s*\(\s*location\s*=\s*0\s*\)\s*out\s+vec4\s+fragColor\s*;/;

    expect(defaultFragment).toMatch(output);
    expect(errorFragment).toMatch(output);
  });

  it('declares the IBL samplers used by the default fragment', () => {
    expect(defaultFragment).toContain(
      `uniform samplerCube ${SHADER_SAMPLER_NAMES.irradiance};`,
    );
    expect(defaultFragment).toContain(
      `uniform samplerCube ${SHADER_SAMPLER_NAMES.prefilteredEnvironment};`,
    );
    expect(defaultFragment).toContain(
      `uniform sampler2D ${SHADER_SAMPLER_NAMES.brdfLut};`,
    );
  });

  it('keeps the validation pair identical to the default pair', () => {
    expect(internalShaders.validation.vertex).toBe(defaultVertex);
    expect(internalShaders.validation.fragment).toBe(defaultFragment);
  });
});

describe('post depth pass shaders', () => {
  const depth = internalShaders.post.depth;

  it.each([
    ['vertex', depth.vertex],
    ['fragment', depth.fragment],
  ])('%s starts with #version 300 es and a precision', (_stage, source) => {
    const lines = source.replace(/\r/g, '').split('\n');

    expect(lines[0]).toBe('#version 300 es');
    expect(lines[1]).toBe('precision highp float;');
  });

  it('normalises linear view depth to the camera clip range', () => {
    expect(depth.fragment).toContain('(vViewDepth - cameraNear)');
    expect(depth.fragment).toContain('cameraFar - cameraNear');
    expect(depth.fragment).toContain('clamp(depth, 0.0, 1.0)');
  });

  it('writes a single-channel result', () => {
    expect(depth.fragment).toContain(
      'fragColor = vec4(clamp(depth, 0.0, 1.0), 0.0, 0.0, 1.0);',
    );
  });
});
