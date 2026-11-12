import mossyForestSource from '@/assets/hdri/mossy_forest_2k.hdr?url';
import peppermintSource from '@/assets/hdri/peppermint_powerplant_2k.hdr?url';
import pergolaSource from '@/assets/hdri/pergola_walkway_2k.hdr?url';
import qwantaniSource from '@/assets/hdri/qwantani_sunrise_2k.hdr?url';
import woodenStudioSource from '@/assets/hdri/wooden_studio_17_2k.hdr?url';

/**
 * Raw equirectangular panoramas used to produce the shipped `.env` assets.
 *
 * This module is only reachable from `bake.html`, so Vite never emits the
 * source `.hdr` files into the application bundle: they exist in the repository
 * as the reproducible input of `npm run bake:env`, while the app loads the
 * baked (and much smaller) prefiltered cubemaps.
 *
 * `id` must match the corresponding `PreviewHdri.id`, which
 * `hdriSources.test.ts` enforces.
 */
export interface HdriBakeSource {
  /** Catalog id of the environment this source produces. */
  readonly id: string;
  /** Source panorama URL. Dev-server/bake-time only. */
  readonly sourceUrl: string;
}

export const hdriBakeSources: readonly HdriBakeSource[] = [
  { id: 'wooden-studio-17', sourceUrl: woodenStudioSource },
  { id: 'peppermint-powerplant', sourceUrl: peppermintSource },
  { id: 'pergola-walkway', sourceUrl: pergolaSource },
  { id: 'qwantani-sunrise', sourceUrl: qwantaniSource },
  { id: 'mossy-forest', sourceUrl: mossyForestSource },
];

/** `.env` filename produced for a source id. */
export function envFileNameFor(id: string): string {
  return `${id}.env`;
}
