import { describe, expect, it } from 'vitest';

import {
  defaultPreviewHdri,
  findPreviewHdri,
  previewHdris,
} from './previewHdris';

describe('previewHdris', () => {
  it('lists every bundled HDR asset with a human-readable name', () => {
    expect(previewHdris.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'wooden-studio-17', label: 'Wooden Studio 17' },
      { id: 'peppermint-powerplant', label: 'Peppermint Powerplant' },
      { id: 'pergola-walkway', label: 'Pergola Walkway' },
      { id: 'qwantani-sunrise', label: 'Qwantani Sunrise' },
      { id: 'mossy-forest', label: 'Mossy Forest' },
    ]);
    expect(previewHdris.every((hdri) => hdri.url.length > 0)).toBe(true);
  });

  it('uses the first asset as the default selection', () => {
    expect(defaultPreviewHdri).toBe(previewHdris[0]);
  });

  it('resolves HDRIs by id and rejects unknown ids', () => {
    expect(findPreviewHdri('peppermint-powerplant')).toBe(previewHdris[1]);
    expect(findPreviewHdri('missing')).toBeUndefined();
  });
});
