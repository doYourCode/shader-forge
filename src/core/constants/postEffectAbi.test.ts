import { describe, expect, it } from 'vitest';

import {
  POST_EFFECT_RESERVED_NAMES,
  POST_EFFECT_SAMPLER_NAMES,
  POST_EFFECT_SAMPLER_SPECS,
  POST_EFFECT_SAMPLERS,
  POST_EFFECT_UNIFORM_SPECS,
  POST_EFFECT_UNIFORMS,
} from './postEffectAbi';

describe('post effect ABI', () => {
  it('keeps the type/hint specs in sync with the bound names', () => {
    expect(Object.keys(POST_EFFECT_UNIFORM_SPECS).sort()).toEqual(
      [...POST_EFFECT_UNIFORMS].sort(),
    );
    expect(Object.keys(POST_EFFECT_SAMPLER_SPECS).sort()).toEqual(
      [...POST_EFFECT_SAMPLERS].sort(),
    );

    for (const spec of [
      ...Object.values(POST_EFFECT_UNIFORM_SPECS),
      ...Object.values(POST_EFFECT_SAMPLER_SPECS),
    ]) {
      expect(spec.glslType.length).toBeGreaterThan(0);
      expect(spec.hint.length).toBeGreaterThan(10);
    }
  });
  it('reserves every uniform and sampler the binder provides', () => {
    for (const name of [...POST_EFFECT_UNIFORMS, ...POST_EFFECT_SAMPLERS]) {
      expect(POST_EFFECT_RESERVED_NAMES.has(name)).toBe(true);
    }
  });

  it('exposes a dedicated normalised depth sampler', () => {
    expect(POST_EFFECT_SAMPLER_NAMES.depth).toBe('depthTexture');
    expect(POST_EFFECT_SAMPLERS).toContain(POST_EFFECT_SAMPLER_NAMES.depth);
  });

  it('keeps the built-in varyings and display parameter reserved', () => {
    for (const name of ['vUV', 'fragColor', 'scale', 'toneMappingMode']) {
      expect(POST_EFFECT_RESERVED_NAMES.has(name)).toBe(true);
    }
  });
});
