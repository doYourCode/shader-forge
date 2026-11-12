import mossyForestUrl from '@/assets/hdri/env/mossy-forest.env?url';
import peppermintUrl from '@/assets/hdri/env/peppermint-powerplant.env?url';
import pergolaWalkwayUrl from '@/assets/hdri/env/pergola-walkway.env?url';
import qwantaniSunriseUrl from '@/assets/hdri/env/qwantani-sunrise.env?url';
import woodenStudioUrl from '@/assets/hdri/env/wooden-studio-17.env?url';
import type { PreviewHdri } from '@/core/models/previewHdri';

const defaultHdri: PreviewHdri = {
  id: 'wooden-studio-17',
  label: 'Wooden Studio 17',
  url: woodenStudioUrl,
  format: 'env',
};

/**
 * Environments available in the scene viewer.
 *
 * Entries point at prefiltered `.env` assets produced by `npm run bake:env`
 * from the raw panoramas in `src/assets/hdri`. Adding another environment is a
 * one-line change here plus a source entry in `src/tools/hdriSources.ts`; the
 * two lists are kept in sync by `hdriSources.test.ts`.
 */
export const previewHdris: readonly PreviewHdri[] = [
  defaultHdri,
  {
    id: 'peppermint-powerplant',
    label: 'Peppermint Powerplant',
    url: peppermintUrl,
    format: 'env',
  },
  {
    id: 'pergola-walkway',
    label: 'Pergola Walkway',
    url: pergolaWalkwayUrl,
    format: 'env',
  },
  {
    id: 'qwantani-sunrise',
    label: 'Qwantani Sunrise',
    url: qwantaniSunriseUrl,
    format: 'env',
  },
  {
    id: 'mossy-forest',
    label: 'Mossy Forest',
    url: mossyForestUrl,
    format: 'env',
  },
];

export const defaultPreviewHdri = defaultHdri;

export function findPreviewHdri(id: string): PreviewHdri | undefined {
  return previewHdris.find((hdri) => hdri.id === id);
}
