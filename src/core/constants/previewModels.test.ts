import { describe, expect, it } from 'vitest';

import { assetUrlMaps } from '@/core/assets/assetUrls';
import { previewModels } from './previewModels';

/** The glob map is the authority on which mesh files exist. */
const MESH_URLS = assetUrlMaps.meshes;

describe('previewModels', () => {
  it('uses unique ids', () => {
    const ids = previewModels.all.map((model) => model.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a non-empty id, label and URL', () => {
    for (const model of previewModels.all) {
      expect(model.id.trim().length).toBeGreaterThan(0);
      expect(model.label.trim().length).toBeGreaterThan(0);
      expect(model.url.trim().length).toBeGreaterThan(0);
    }
  });

  it('declares the expected default explicitly', () => {
    expect(previewModels.default.id).toBe('monkey');
    expect(previewModels.defaults.model).toBe(previewModels.default);
    expect(previewModels.default).toBe(previewModels.find('monkey'));
  });

  it('maps every catalog URL to a bundled mesh and claims every mesh', () => {
    const bundledUrls = Object.values(MESH_URLS);
    const claimedUrls = previewModels.all.map((model) => model.url);

    // Both directions: no dead catalog entry and no orphan bundled file.
    expect(new Set(claimedUrls)).toEqual(new Set(bundledUrls));
    expect(new Set(claimedUrls).size).toBe(claimedUrls.length);
  });

  it('has a stable id contract', () => {
    // Ids are persisted in user data and are a compatibility contract.
    expect(previewModels.all.map((model) => model.id)).toMatchInlineSnapshot(`
      [
        "monkey",
        "sphere",
        "cube",
        "bunny",
        "dragon",
      ]
    `);
  });
});
