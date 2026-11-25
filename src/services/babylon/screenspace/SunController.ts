import {
  CascadedShadowGenerator,
  Color3,
  DirectionalLight,
  ShadowGenerator,
  Vector3,
  type AbstractMesh,
  type Camera,
  type Scene,
} from '@babylonjs/core';
import { DEFAULT_SUN_INTENSITY } from '@/core/constants/screenSpaceRender';
import type { LoadedSceneMeshes } from './SceneAssetProvider';

/**
 * Cascades are recomputed from the camera every frame, so each extra cascade
 * is another full caster pass. Two keeps a whole-scene preview affordable.
 */
const CASCADE_COUNT = 2;

/** 2048² over the ~120 u street: ~6 cm/texel before cascading. */
const SHADOW_MAP_SIZE = 2048;

/**
 * Bistro is ~166 u deep; shadowing the whole view is wasted precision. The
 * cascades stop where the eye stops caring, and the IBL covers the distance.
 */
const SHADOW_MAX_Z = 220;

/** Late-afternoon direction: the light travels down and along the street. */
const SUN_DIRECTION = new Vector3(-0.45, -1, -0.35);

/** Slightly warm sun so the HDRI and the direct light read as one scene. */
const SUN_COLOR = new Color3(1, 0.96, 0.9);

/**
 * Meshes the shadow map draws.
 *
 * The asset container lists one entry per node, so it holds both source meshes
 * and their instances. Shadow casting is instanced: listing the sources only
 * keeps one draw per geometry instead of one per instance.
 */
export function shadowCasters(
  meshes: LoadedSceneMeshes,
): readonly AbstractMesh[] {
  return meshes.opaque.filter((mesh) => !mesh.isAnInstance);
}

/**
 * The preview's direct light and its cascaded shadow map.
 *
 * The sun is dynamic: the cascades follow the active camera every frame, so
 * walking down the street keeps shadows crisp near the view while the far end
 * falls back to the IBL. Effects never see this light directly — it contributes
 * to the PBR scene colour (and therefore to the G-buffer reflectivity/albedo
 * inputs) the same way the environment does.
 */
export class SunController {
  private readonly light: DirectionalLight;
  private readonly shadows: CascadedShadowGenerator;
  private disposed = false;

  constructor(
    scene: Scene,
    camera: Camera,
    intensity: number = DEFAULT_SUN_INTENSITY,
  ) {
    this.light = new DirectionalLight(
      'sf-sun',
      SUN_DIRECTION.clone().normalize(),
      scene,
    );
    this.light.intensity = intensity;
    this.light.diffuse = SUN_COLOR;
    this.light.specular = SUN_COLOR;

    // The cascaded generator builds its own per-cascade shadow cameras from
    // the active camera, so the light's position only matters for debugging.
    this.shadows = new CascadedShadowGenerator(
      SHADOW_MAP_SIZE,
      this.light,
      false,
      camera,
      true,
    );
    this.shadows.numCascades = CASCADE_COUNT;
    this.shadows.shadowMaxZ = SHADOW_MAX_Z;
    this.shadows.lambda = 0.8;
    this.shadows.stabilizeCascades = true;
    this.shadows.depthClamp = true;
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    // Bistro is authored in metres with a ~3300 u camera far plane; the
    // explicit Z bounds and these offsets keep the depth range usable.
    this.shadows.bias = 0.001;
    this.shadows.normalBias = 0.02;
  }

  /**
   * Declares who casts and who receives. Called after the scene split and
   * before the first frame that draws the meshes, because `receiveShadows`
   * is read when the PBR effect is built.
   */
  bind(meshes: LoadedSceneMeshes): void {
    if (this.disposed) return;

    const shadowMap = this.shadows.getShadowMap();
    if (shadowMap) {
      shadowMap.renderList = shadowCasters(meshes).slice();
    }

    // Reflection/transmission surfaces receive light too; only the opaque
    // subset casts, so shop windows do not black out the street.
    for (const mesh of [...meshes.opaque, ...meshes.transparent]) {
      mesh.receiveShadows = true;
    }
  }

  setIntensity(intensity: number): void {
    if (this.disposed) return;
    this.light.intensity = intensity;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.shadows.dispose();
    this.light.dispose();
  }
}
