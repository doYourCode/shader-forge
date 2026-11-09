import { Constants, type BaseTexture, type Scene } from '@babylonjs/core';
import { HDRFiltering } from '@babylonjs/core/Materials/Textures/Filtering/hdrFiltering';
import { HDRIrradianceFiltering } from '@babylonjs/core/Materials/Textures/Filtering/hdrIrradianceFiltering';

/**
 * Samples per texel used by Babylon's HDR filters. The offline default (4096)
 * is meant for baking; `HIGH` (64) keeps an interactive HDRI swap responsive
 * while still producing a correctly GGX-convolved radiance cubemap.
 */
const IBL_FILTERING_QUALITY = Constants.TEXTURE_FILTERING_QUALITY_HIGH;

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
 * the engine. The port keeps `EnvironmentController` free of Babylon filtering
 * details (and testable without a GPU).
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
    async prefilter(texture) {
      // Diffuse convolution must sample the unfiltered radiance source, so it
      // runs first. Radiance prefiltering swaps the source internal texture in
      // place and preserves the irradiance texture attached here.
      const irradiance = await new HDRIrradianceFiltering(engine, {
        quality: IBL_FILTERING_QUALITY,
      }).prefilter(texture);
      texture.irradianceTexture = irradiance;

      await new HDRFiltering(engine, {
        quality: IBL_FILTERING_QUALITY,
      }).prefilter(texture);
    },
  };
};
