import { describe, expect, it } from 'vitest';

import effectSource from '@/assets/internal-shaders/post.screenspace.frag.glsl?raw';
import displaySource from '@/assets/internal-shaders/post.screenspace.display.frag.glsl?raw';
import {
  SCREEN_SPACE_DISPLAY_SAMPLERS,
  SCREEN_SPACE_DISPLAY_UNIFORM_NAMES,
  SCREEN_SPACE_DISPLAY_UNIFORMS,
  SCREEN_SPACE_RESERVED_NAMES,
  SCREEN_SPACE_SAMPLER_NAMES,
  SCREEN_SPACE_SAMPLERS,
  SCREEN_SPACE_UNIFORM_NAMES,
  SCREEN_SPACE_UNIFORMS,
} from './screenSpaceAbi';

describe('screen-space ABI', () => {
  it('exposes the whole scene G-buffer', () => {
    expect(Object.values(SCREEN_SPACE_SAMPLER_NAMES)).toEqual([
      'textureSampler',
      'sceneColorTexture',
      'depthTexture',
      'normalTexture',
      'albedoTexture',
      'materialTexture',
      'velocityTexture',
      'objectIdTexture',
    ]);
    expect(new Set(SCREEN_SPACE_SAMPLERS).size).toBe(
      SCREEN_SPACE_SAMPLERS.length,
    );
  });

  it('declares every public sampler in the default effect', () => {
    for (const sampler of SCREEN_SPACE_SAMPLERS) {
      expect(effectSource).toContain(`uniform sampler2D ${sampler};`);
    }
  });

  it('declares every sampler and display uniform in the display pass', () => {
    for (const sampler of SCREEN_SPACE_DISPLAY_SAMPLERS) {
      expect(displaySource).toContain(`uniform sampler2D ${sampler};`);
    }

    expect(displaySource).toContain(
      `uniform float ${SCREEN_SPACE_DISPLAY_UNIFORM_NAMES.toneMappingMode};`,
    );
    expect(displaySource).toContain(
      `uniform float ${SCREEN_SPACE_DISPLAY_UNIFORM_NAMES.debugMode};`,
    );
  });

  it('reserves every ABI name so user data cannot collide', () => {
    for (const name of [
      ...SCREEN_SPACE_UNIFORMS,
      ...SCREEN_SPACE_SAMPLERS,
      ...SCREEN_SPACE_DISPLAY_UNIFORMS,
      ...SCREEN_SPACE_DISPLAY_SAMPLERS,
      'vUV',
      'fragColor',
    ]) {
      expect(SCREEN_SPACE_RESERVED_NAMES.has(name)).toBe(true);
    }
  });

  it('names all uniforms used by the default effect', () => {
    for (const uniform of Object.values(SCREEN_SPACE_UNIFORM_NAMES)) {
      expect(effectSource).toContain(`uniform `);
      expect(effectSource).toContain(uniform);
    }
  });
});
