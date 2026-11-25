import { describe, expect, it } from 'vitest';

import { SCREEN_SPACE_SAMPLER_NAMES } from '@/core/constants/screenSpaceAbi';
import {
  orderedScreenSpaceAttachments,
  requiredScreenSpaceAttachments,
} from './gbufferAttachments';

describe('screen-space attachment planning', () => {
  it('requests no attachment for a passthrough that only reads the scene', () => {
    const required = requiredScreenSpaceAttachments(
      new Set([SCREEN_SPACE_SAMPLER_NAMES.scene]),
      'off',
    );

    expect(orderedScreenSpaceAttachments(required)).toEqual([]);
  });

  it('requests only the attachments the effect reads', () => {
    const required = requiredScreenSpaceAttachments(
      new Set([
        SCREEN_SPACE_SAMPLER_NAMES.scene,
        SCREEN_SPACE_SAMPLER_NAMES.depth,
      ]),
      'off',
    );

    expect(orderedScreenSpaceAttachments(required)).toEqual(['depth']);
  });

  it('never requests velocity for an effect that does not read it', () => {
    const required = requiredScreenSpaceAttachments(
      new Set([
        SCREEN_SPACE_SAMPLER_NAMES.normal,
        SCREEN_SPACE_SAMPLER_NAMES.albedo,
        SCREEN_SPACE_SAMPLER_NAMES.material,
      ]),
      'off',
    );

    expect(orderedScreenSpaceAttachments(required)).toEqual([
      'normal',
      'albedo',
      'material',
    ]);
  });

  it('adds the attachments a debug view needs', () => {
    const required = requiredScreenSpaceAttachments(new Set(), 'material');

    expect(orderedScreenSpaceAttachments(required)).toEqual([
      'normal',
      'albedo',
      'material',
    ]);
  });

  it('keeps the MRT layout deterministic for an unchanged set', () => {
    const first = requiredScreenSpaceAttachments(
      new Set([
        SCREEN_SPACE_SAMPLER_NAMES.velocity,
        SCREEN_SPACE_SAMPLER_NAMES.depth,
      ]),
      'off',
    );
    const second = requiredScreenSpaceAttachments(
      new Set([
        SCREEN_SPACE_SAMPLER_NAMES.depth,
        SCREEN_SPACE_SAMPLER_NAMES.velocity,
      ]),
      'off',
    );

    expect(orderedScreenSpaceAttachments(first)).toEqual(
      orderedScreenSpaceAttachments(second),
    );
  });
});
