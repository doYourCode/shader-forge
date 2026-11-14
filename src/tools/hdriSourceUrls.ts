import { resolveAssetUrl } from '@/core/assets/assetUrls';

/**
 * Raw equirectangular panoramas used to produce the shipped `.env` assets.
 *
 * This module is reachable only from `bake.html` (through `bakeEnv.ts`), so
 * Vite never emits the source `.hdr` files into the application bundle. They
 * remain the reproducible input of `npm run bake:env`, while the app loads the
 * baked (and much smaller) prefiltered cubemaps from `assetUrls`.
 */
const HDR_SOURCE_URLS = import.meta.glob('/src/assets/hdri/*.hdr', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Readonly<Record<string, string>>;

/** Resolves a raw panorama path such as `hdri/mossy_forest_2k.hdr`. */
export function resolveHdrSourceUrl(path: string): string {
  return resolveAssetUrl(HDR_SOURCE_URLS, path);
}
