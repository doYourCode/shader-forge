import { describe, expect, it } from 'vitest';

import { previewHdris } from '@/core/constants/previewHdris';
import { envFileNameFor, hdriBakeSources } from './hdriSources';

describe('hdriSources', () => {
  it('covers exactly the environments exposed by the catalog', () => {
    const sourceIds = hdriBakeSources.map((source) => source.id).sort();
    const catalogIds = previewHdris.map((hdri) => hdri.id).sort();

    expect(sourceIds).toEqual(catalogIds);
  });

  it('provides a source panorama for every baked environment', () => {
    expect(hdriBakeSources).not.toHaveLength(0);
    expect(hdriBakeSources.every((source) => source.sourceUrl.length > 0)).toBe(
      true,
    );
  });

  it('names the baked file after the catalog id', () => {
    for (const source of hdriBakeSources) {
      expect(envFileNameFor(source.id)).toBe(`${source.id}.env`);
    }
  });
});
