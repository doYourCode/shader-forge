import {
  BRDFTextureTools,
  type BaseTexture,
  type Scene,
  type ShaderMaterial,
} from '@babylonjs/core';
import { SHADER_SAMPLER_NAMES } from './MaterialController';

/** Creates (or returns the cached) split-sum BRDF LUT for a scene. */
export type BrdfLutProvider = (scene: Scene) => BaseTexture;

/** The slice of the IBL resources the per-frame binder needs. */
export interface IblBindingTarget {
  bind(material: ShaderMaterial): void;
  dispose(): void;
}

/**
 * Projects the active scene environment and Babylon's split-sum BRDF LUT onto
 * the built-in IBL samplers.
 *
 * `environmentTexture` is the GGX-prefiltered radiance cubemap (its mip levels
 * encode roughness) and carries the cosine-convolved irradiance cubemap
 * produced by `EnvironmentController`. The BRDF LUT is independent of the HDRI,
 * so it is obtained once and reused for the lifetime of the scene. It uses
 * Babylon's split-sum convention: sample it at `(NdotV, roughness)`; R is the
 * Fresnel bias and G is the directional albedo, so the specular term is
 * `mix(lut.r, lut.g, F0)`.
 */
export class IblEnvironment implements IblBindingTarget {
  private readonly scene: Scene;
  private readonly getBrdfLut: BrdfLutProvider;
  private brdfLut: BaseTexture | null = null;
  private brdfRequested = false;
  private disposed = false;

  constructor(
    scene: Scene,
    getBrdfLut: BrdfLutProvider = BRDFTextureTools.GetEnvironmentBRDFTexture,
  ) {
    this.scene = scene;
    this.getBrdfLut = getBrdfLut;
  }

  bind(material: ShaderMaterial): void {
    if (this.disposed) return;

    const environment = this.scene.environmentTexture;
    if (environment) {
      material.setTexture(
        SHADER_SAMPLER_NAMES.prefilteredEnvironment,
        environment,
      );

      const irradiance = environment.irradianceTexture;
      if (irradiance) {
        material.setTexture(SHADER_SAMPLER_NAMES.irradiance, irradiance);
      }
    }

    const brdfLut = this.resolveBrdfLut();
    if (brdfLut) {
      material.setTexture(SHADER_SAMPLER_NAMES.brdfLut, brdfLut);
    }
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    // Babylon caches the BRDF LUT on the scene and disposes it with the scene.
    this.brdfLut = null;
  }

  private resolveBrdfLut(): BaseTexture | null {
    if (!this.brdfRequested) {
      this.brdfRequested = true;
      this.brdfLut = this.getBrdfLut(this.scene);
    }

    return this.brdfLut;
  }
}
