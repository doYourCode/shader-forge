import peppermintUrl from '@/assets/hdri/peppermint_powerplant_2k.hdr?url';
import woodenStudioUrl from '@/assets/hdri/wooden_studio_17_2k.hdr?url';
import pergolaWalkwayUrl from '@/assets/hdri/pergola_walkway_2k.hdr?url';
import qwantaniSunriseUrl from '@/assets/hdri/qwantani_sunrise_2k.hdr?url';
import mossyForestUrl from '@/assets/hdri/mossy_forest_2k.hdr?url';
import type { PreviewHdri } from '@/core/models/previewHdri';

const defaultHdri: PreviewHdri = {
  id: 'wooden-studio-17',
  label: 'Wooden Studio 17',
  url: woodenStudioUrl,
};

/**
 * HDR environment maps available in the scene viewer. Adding another HDR is a
 * one-line change: import its URL and append an entry to this list.
 */
export const previewHdris: readonly PreviewHdri[] = [
  defaultHdri,
  {
    id: 'peppermint-powerplant',
    label: 'Peppermint Powerplant',
    url: peppermintUrl,
  },
    {
    id: 'pergola-walkway',
    label: 'Pergola Walkway',
    url: pergolaWalkwayUrl,
  },
    {
    id: 'qwantani-sunrise',
    label: 'Qwantani Sunrise',
    url: qwantaniSunriseUrl,
  },
      {
    id: 'mossy-forest',
    label: 'Mossy Forest',
    url: mossyForestUrl,
  },
];

export const defaultPreviewHdri = defaultHdri;

export function findPreviewHdri(id: string): PreviewHdri | undefined {
  return previewHdris.find((hdri) => hdri.id === id);
}
