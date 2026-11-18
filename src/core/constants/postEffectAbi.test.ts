import { describe, expect, it } from 'vitest';

import {
  POST_EFFECT_RESERVED_NAMES,
  POST_EFFECT_SAMPLER_NAMES,
  POST_EFFECT_SAMPLERS,
  POST_EFFECT_UNIFORMS,
} from './postEffectAbi';

describe('post effect ABI', () => {
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
