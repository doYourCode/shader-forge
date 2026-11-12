import {
  Constants,
  type AbstractEngine,
  type BaseTexture,
  type Scene,
} from '@babylonjs/core';
import { HDRFiltering } from '@babylonjs/core/Materials/Textures/Filtering/hdrFiltering';
import { HDRIrradianceFiltering } from '@babylonjs/core/Materials/Textures/Filtering/hdrIrradianceFiltering';

/**
 * Samples per texel used by Babylon's HDR filters. The offline default (4096)
 * is meant for baking; `HIGH` (64) keeps an interactive HDRI swap responsive
 * while still producing a correctly GGX-convolved radiance cubemap.
 *
 * This is the runtime fallback quality. Shipped environments are baked offline
 * (`npm run bake:env`) with the same filters, so they never pay this cost at
 * load time.
 */
export const IBL_FILTERING_QUALITY = Constants.TEXTURE_FILTERING_QUALITY_HIGH;

/**
 * Turns a freshly loaded linear HDR cubemap into the two environment-side IBL
 * resources:
 *
 * - a cosine-convolved irradiance cubemap (stored on `texture.irradianceTexture`);
 * - the same texture converted in place into a GGX-prefiltered radiance cubemap
 *   whose mip levels encode roughness.
 *
 * Both operations are Babylon's native HDR filters, so cubemap orientation,
 * linear colour and the roughness-to-LOD mapping stay identical to the rest of
 * the engine.
 *
 * The runtime controller (raw `.hdr` sources) and the offline environment
 * baker (`src/tools/bakeEnv.ts`) share this function, so a baked `.env` is
 * produced by exactly the pipeline the app used to run on every load.
 */
export async function prefilterEnvironmentTexture(
  engine: AbstractEngine,
  texture: BaseTexture,
  quality: number = IBL_FILTERING_QUALITY,
): Promise<void> {
  // Diffuse convolution must sample the unfiltered radiance source, so it runs
  // first. Radiance prefiltering swaps the source internal texture in place and
  // preserves the irradiance texture attached here.
  const irradiance = await new HDRIrradianceFiltering(engine, {
    quality,
  }).prefilter(texture);
  texture.irradianceTexture = irradiance;

  await new HDRFiltering(engine, { quality }).prefilter(texture);
}

/**
 * The port the environment controller depends on. Keeping it this narrow means
 * the controller stays testable without a GPU and knows nothing about the HDR
 * filter implementations.
 */
export interface EnvironmentIblFilter {
  prefilter(texture: BaseTexture): Promise<void>;
}

export type EnvironmentIblFilterFactory = (
  scene: Scene,
) => EnvironmentIblFilter;

export const createNativeEnvironmentIblFilter: EnvironmentIblFilterFactory = (
  scene,
) => {
  const engine = scene.getEngine();

  return {
    prefilter: (texture) => prefilterEnvironmentTexture(engine, texture),
  };
};
