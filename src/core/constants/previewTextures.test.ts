import { describe, expect, it } from 'vitest';

import { assetUrlMaps } from '@/core/assets/assetUrls';
import type { PreviewTextureFormat } from '@/core/models/previewTexture';
import type { SamplerKind } from '@/core/models/userUniform';
import {
  findPreviewTexture,
  previewTextureCatalog,
  previewTextures,
  previewTexturesFor,
} from './previewTextures';

const FORMAT_BY_SAMPLER: Record<SamplerKind, PreviewTextureFormat> = {
  sampler2D: 'image',
  samplerCube: 'cubemap',
};

/** The glob maps are the authority on which texture files exist. */
const TEXTURE_URLS = assetUrlMaps.textures;
const TEXTURE_THUMBNAIL_URLS = assetUrlMaps.textureThumbnails;

describe('previewTextures', () => {
  it('uses unique ids', () => {
    const ids = previewTextures.map((texture) => texture.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a non-empty id, label, URL and thumbnail', () => {
    for (const texture of previewTextures) {
      expect(texture.id.trim().length).toBeGreaterThan(0);
      expect(texture.label.trim().length).toBeGreaterThan(0);
      expect(texture.url.trim().length).toBeGreaterThan(0);
      expect(texture.thumbnailUrl?.trim().length).toBeGreaterThan(0);
    }
  });

  it('uses only known samplers', () => {
    for (const texture of previewTextures) {
      expect(['sampler2D', 'samplerCube']).toContain(texture.sampler);
    }
  });

  it('keeps the sampler and format consistent', () => {
    for (const texture of previewTextures) {
      expect(texture.format).toBe(FORMAT_BY_SAMPLER[texture.sampler]);
    }
  });

  it('exposes no default, because a texture is always picked explicitly', () => {
    expect(Object.hasOwn(previewTextureCatalog, 'default')).toBe(false);
  });

  it('maps every catalog URL to a bundled texture and claims every file', () => {
    const bundledUrls = Object.values(TEXTURE_URLS);
    const claimedUrls = previewTextures.map((texture) => texture.url);

    // Both directions: no dead catalog entry and no orphan bundled file.
    expect(new Set(claimedUrls)).toEqual(new Set(bundledUrls));
    expect(new Set(claimedUrls).size).toBe(claimedUrls.length);
  });

  it('maps every thumbnail URL to a bundled preview and claims every file', () => {
    const bundledUrls = Object.values(TEXTURE_THUMBNAIL_URLS);
    const claimedUrls = previewTextures.map((texture) => texture.thumbnailUrl);

    expect(new Set(claimedUrls)).toEqual(new Set(bundledUrls));
    expect(new Set(claimedUrls).size).toBe(claimedUrls.length);
  });

  it('looks up a known id and rejects an unknown one', () => {
    expect(findPreviewTexture('uv-checker-01')?.label).toBe('UV Checker 01');
    expect(findPreviewTexture('does-not-exist')).toBeUndefined();
    expect(previewTextureCatalog.find('uv-checker-02')?.id).toBe(
      'uv-checker-02',
    );
  });

  it('filters by sampler kind', () => {
    for (const sampler of ['sampler2D', 'samplerCube'] as const) {
      const entries = previewTexturesFor(sampler);

      expect(entries.every((texture) => texture.sampler === sampler)).toBe(true);
    }
  });

  it('has a stable id contract', () => {
    // Ids are persisted in user data and are a compatibility contract.
    expect(previewTextures.map((texture) => texture.id)).toMatchInlineSnapshot(`
      [
        "uv-checker-01",
        "uv-checker-02",
      ]
    `);
  });
});
