import { describe, expect, it } from 'vitest';

import {
  envFileNameFor,
  hdriBakeSources,
  previewHdris,
} from '@/core/constants/previewHdris';
import { resolveHdrSourceUrl } from './hdriSourceUrls';

/** Independent view of the bake inputs; only this module may resolve them. */
const HDR_SOURCES = import.meta.glob('/src/assets/hdri/*.hdr', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('hdriSourceUrls', () => {
  it('resolves every declared source panorama', () => {
    for (const source of hdriBakeSources) {
      expect(resolveHdrSourceUrl(source.sourcePath)).toBe(
        HDR_SOURCES[`/src/assets/${source.sourcePath}`],
      );
    }
  });

  it('claims every raw panorama exactly once', () => {
    const bundledUrls = Object.values(HDR_SOURCES);
    const claimedUrls = hdriBakeSources.map((source) =>
      resolveHdrSourceUrl(source.sourcePath),
    );

    expect(new Set(claimedUrls)).toEqual(new Set(bundledUrls));
    expect(new Set(claimedUrls).size).toBe(claimedUrls.length);
  });

  it('keeps bake sources aligned with the viewer catalog', () => {
    const catalogIds = new Set(previewHdris.all.map((hdri) => hdri.id));

    for (const source of hdriBakeSources) {
      expect(catalogIds.has(source.id)).toBe(true);
      expect(envFileNameFor(source.id)).toBe(`${source.id}.env`);
    }
  });

  it('throws for a missing panorama instead of returning ""', () => {
    expect(() => resolveHdrSourceUrl('hdri/missing.hdr')).toThrow(
      /hdri\/missing\.hdr/,
    );
  });
});
