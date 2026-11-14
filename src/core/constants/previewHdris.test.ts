import { describe, expect, it } from 'vitest';

import { assetUrlMaps } from '@/core/assets/assetUrls';
import { hdriBakeSources, previewHdris } from './previewHdris';

/** The glob map is the authority on which baked environments exist. */
const ENV_URLS = assetUrlMaps.environments;

describe('previewHdris', () => {
  it('uses unique ids', () => {
    const ids = previewHdris.all.map((hdri) => hdri.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a non-empty id, label and URL', () => {
    for (const hdri of previewHdris.all) {
      expect(hdri.id.trim().length).toBeGreaterThan(0);
      expect(hdri.label.trim().length).toBeGreaterThan(0);
      expect(hdri.url.trim().length).toBeGreaterThan(0);
    }
  });

  it('uses only known storage formats', () => {
    for (const hdri of previewHdris.all) {
      expect(['env', 'hdr']).toContain(hdri.format);
    }
  });

  it('declares the expected default explicitly', () => {
    expect(previewHdris.default.id).toBe('wooden-studio-17');
    expect(previewHdris.defaults.hdri).toBe(previewHdris.default);
    expect(previewHdris.default).toBe(
      previewHdris.find('wooden-studio-17'),
    );
  });

  it('maps every catalog URL to a bundled environment and claims every file', () => {
    const bundledUrls = Object.values(ENV_URLS);
    const claimedUrls = previewHdris.all.map((hdri) => hdri.url);

    // Both directions: no dead catalog entry and no orphan bundled file.
    expect(new Set(claimedUrls)).toEqual(new Set(bundledUrls));
    expect(new Set(claimedUrls).size).toBe(claimedUrls.length);
  });

  it('declares a source panorama for the bakeable environments', () => {
    expect(hdriBakeSources.length).toBeGreaterThan(0);

    for (const source of hdriBakeSources) {
      expect(source.sourcePath.trim().length).toBeGreaterThan(0);
      expect(previewHdris.has(source.id)).toBe(true);
    }
  });

  it('has a stable id contract', () => {
    // Ids are persisted in user data and are a compatibility contract.
    expect(previewHdris.all.map((hdri) => hdri.id)).toMatchInlineSnapshot(`
      [
        "wooden-studio-17",
        "peppermint-powerplant",
        "pergola-walkway",
        "qwantani-sunrise",
        "mossy-forest",
      ]
    `);
  });
});
