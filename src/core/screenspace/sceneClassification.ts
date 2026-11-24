/**
 * Pure classification and framing rules for whole-scene rendering.
 *
 * Babylon objects are not imported here on purpose: the same rules can be
 * tested without a GPU, and the renderer only adapts its meshes/materials to
 * these small structural types.
 */

/** The material fields the screen-space split needs. */
export interface SceneMaterialLike {
  alpha?: number;
  transparencyMode?: number;
  needAlphaBlending?: () => boolean;
  subSurface?: {
    isRefractionEnabled?: boolean;
    refractionIntensity?: number;
    isScatteringEnabled?: boolean;
  };
}

export type SceneMeshClass = 'opaque' | 'transparent' | 'ignored';

/** Babylon's `Material.MATERIAL_ALPHABLEND`. */
const MATERIAL_ALPHABLEND = 2;

/**
 * Transmissive materials are excluded from the G-buffer and from the
 * screen-space chain; they render in the separate transparent overlay pass.
 */
export function isTransmissiveMaterial(material: SceneMaterialLike): boolean {
  const surface = material.subSurface;
  if (!surface) return false;

  // `refractionIntensity` defaults to 1 even when refraction is disabled, so
  // it is not a usable discriminator. Babylon turns `isRefractionEnabled` on
  // only for materials that actually use the transmission path.
  return surface.isRefractionEnabled === true;
}

export function isAlphaBlendedMaterial(material: SceneMaterialLike): boolean {
  if ((material.alpha ?? 1) < 0.999) return true;
  if (material.transparencyMode === MATERIAL_ALPHABLEND) return true;

  return material.needAlphaBlending?.() === true;
}

/**
 * Classifies one mesh from every material its submeshes use.
 *
 * A mesh is transparent when any of its materials is transmissive or alpha
 * blended, so no submesh silently leaks into the opaque G-buffer. A mesh with
 * no materials at all is ignored (it has nothing to draw).
 */
export function classifySceneMaterials(
  materials: readonly SceneMaterialLike[],
): SceneMeshClass {
  if (materials.length === 0) return 'ignored';

  if (materials.some((material) => isTransmissiveMaterial(material))) {
    return 'transparent';
  }

  if (materials.some((material) => isAlphaBlendedMaterial(material))) {
    return 'transparent';
  }

  return 'opaque';
}

export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SceneFraming {
  readonly center: Vec3Like;
  readonly radius: number;
  readonly position: Vec3Like;
  readonly minZ: number;
  readonly maxZ: number;
}

const DEFAULT_VIEW_DIRECTION: Vec3Like = { x: 0.6, y: 0.35, z: 1 };

/**
 * Frames a scene by its world bounds. The result is intentionally
 * deterministic and independent of Babylon so camera placement can be tested.
 */
export function computeSceneFraming(
  min: Vec3Like,
  max: Vec3Like,
  viewDirection: Vec3Like = DEFAULT_VIEW_DIRECTION,
): SceneFraming {
  const center: Vec3Like = {
    x: (min.x + max.x) * 0.5,
    y: (min.y + max.y) * 0.5,
    z: (min.z + max.z) * 0.5,
  };

  const sizeX = max.x - min.x;
  const sizeY = max.y - min.y;
  const sizeZ = max.z - min.z;
  const radius = Math.max(
    Math.sqrt(sizeX * sizeX + sizeY * sizeY + sizeZ * sizeZ) * 0.5,
    0.01,
  );

  const length = Math.hypot(viewDirection.x, viewDirection.y, viewDirection.z);
  const unit =
    length > 1e-5
      ? {
          x: viewDirection.x / length,
          y: viewDirection.y / length,
          z: viewDirection.z / length,
        }
      : { x: 0, y: 0, z: 1 };

  const distance = Math.max(radius * 2.4, 1);
  const minZ = Math.max(radius * 0.0005, 0.05);

  return {
    center,
    radius,
    position: {
      x: center.x + unit.x * distance,
      y: center.y + unit.y * distance,
      z: center.z + unit.z * distance,
    },
    minZ,
    maxZ: Math.max(radius * 40, minZ * 1000),
  };
}
