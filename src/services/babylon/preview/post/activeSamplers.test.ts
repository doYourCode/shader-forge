import { describe, expect, it } from 'vitest';

import type { PostProcess } from '@babylonjs/core';
import { activeSamplers } from './activeSamplers';

function pass(samplers: readonly string[]): Pick<PostProcess, 'getEffect'> {
  return {
    getEffect: () =>
      ({
        getSamplers: () => samplers,
      }) as unknown as ReturnType<PostProcess['getEffect']>,
  };
}

describe('activeSamplers', () => {
  it('unions the sampler lists of every pass', () => {
    const names = activeSamplers([
      pass(['textureSampler', 'depthTexture']),
      pass(['textureSampler', 'objectIdTexture']),
    ]);

    expect(names).toEqual(
      new Set(['textureSampler', 'depthTexture', 'objectIdTexture']),
    );
  });

  it('normalises array sampler entries', () => {
    expect(activeSamplers([pass(['taps[0]'])])).toEqual(new Set(['taps']));
  });

  it('ignores passes without a live effect', () => {
    const withoutEffect = {
      getEffect: () => null,
    } as unknown as Pick<PostProcess, 'getEffect'>;

    expect(activeSamplers([withoutEffect])).toEqual(new Set());
  });
});
