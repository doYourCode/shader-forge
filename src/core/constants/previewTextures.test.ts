import { describe, expect, it } from 'vitest';

import type { PreviewTextureFormat } from '@/core/models/previewTexture';
import type { SamplerKind } from '@/core/models/userUniform';
import {
  findPreviewTexture,
  previewTextures,
  previewTexturesFor,
} from './previewTextures';

const FORMAT_BY_SAMPLER: Record<SamplerKind, PreviewTextureFormat> = {
  sampler2D: 'image',
  samplerCube: 'cubemap',
};

describe('previewTextures', () => {
  it('uses unique ids', () => {
    const ids = previewTextures.map((texture) => texture.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a non-empty label and URL', () => {
    for (const texture of previewTextures) {
      expect(texture.id.trim().length).toBeGreaterThan(0);
      expect(texture.label.trim().length).toBeGreaterThan(0);
      expect(texture.url.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps the sampler and format consistent', () => {
    for (const texture of previewTextures) {
      expect(texture.format).toBe(FORMAT_BY_SAMPLER[texture.sampler]);
    }
  });

  it('looks up a known id', () => {
    expect(findPreviewTexture('uv-checker-01')?.label).toBe('UV Checker 01');
  });

  it('returns undefined for an unknown id', () => {
    expect(findPreviewTexture('does-not-exist')).toBeUndefined();
  });

  it('filters by sampler kind', () => {
    for (const sampler of ['sampler2D', 'samplerCube'] as const) {
      const entries = previewTexturesFor(sampler);

      expect(entries.every((texture) => texture.sampler === sampler)).toBe(true);
    }
  });
});
