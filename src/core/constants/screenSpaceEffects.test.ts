import { describe, expect, it } from 'vitest';

import { SCREEN_SPACE_SAMPLER_NAMES } from './screenSpaceAbi';
import { createScreenSpaceEffect } from './screenSpaceEffects';

describe('screen-space default effect', () => {
  it('starts enabled with a valid passthrough fragment', () => {
    const effect = createScreenSpaceEffect('effect-1', 'Test');

    expect(effect.id).toBe('effect-1');
    expect(effect.name).toBe('Test');
    expect(effect.enabled).toBe(true);
    expect(effect.fragment).toContain('#version 300 es');
    expect(effect.fragment).toContain('fragColor');
  });

  it('documents the original scene colour and the material model', () => {
    const effect = createScreenSpaceEffect('effect-1');

    expect(effect.fragment).toContain(SCREEN_SPACE_SAMPLER_NAMES.sceneColor);
    expect(effect.fragment).toContain('gbufferRoughness');
    expect(effect.fragment).toContain('gbufferMetallic');
    expect(effect.fragment).toContain('gbufferAlbedo');
  });
});
