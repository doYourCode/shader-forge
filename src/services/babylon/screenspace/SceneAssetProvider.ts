import {
  SceneLoader,
  Vector3,
  type AssetContainer,
  type AbstractMesh,
  type Material,
  type Scene,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { PreviewScene } from '@/core/models/previewScene';
import {
  classifySceneMaterials,
  type SceneMaterialLike,
  type SceneMeshClass,
} from '@/core/screenspace/sceneClassification';
import { ensureDracoDecoder } from './DracoSetup';

export const OPAQUE_LAYER = 0x1;
export const TRANSPARENT_LAYER = 0x2;

export interface LoadedSceneMeshes {
  readonly opaque: readonly AbstractMesh[];
  readonly transparent: readonly AbstractMesh[];
  readonly ignored: readonly AbstractMesh[];
}

/**
 * Loads complete GLB scenes and separates them for the screen-space pipeline.
 *
 * The PBR materials are kept exactly as the loader built them; only the
 * transmissive/alpha-blended subset is moved to the overlay layer and has its
 * refraction disabled (the overlay renders it without the transmission helper,
 * so it cannot recursively depend on the scene colour pass).
 */
export class SceneAssetProvider {
  async load(
    scene: Scene,
    asset: PreviewScene,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<AssetContainer> {
    ensureDracoDecoder();

    const container = await SceneLoader.LoadAssetContainerAsync(
      '',
      asset.url,
      scene,
      (event) => {
        onProgress?.(event.loaded, event.total);
      },
    );

    container.addAllToScene();
    return container;
  }

  /** Applies layer masks and material policy; returns the split render lists. */
  prepare(container: AssetContainer): LoadedSceneMeshes {
    const opaque: AbstractMesh[] = [];
    const transparent: AbstractMesh[] = [];
    const ignored: AbstractMesh[] = [];

    for (const mesh of container.meshes) {
      if (mesh.getTotalVertices() === 0 || !mesh.isVisible) {
        ignored.push(mesh);
        continue;
      }

      const materials = materialsForMesh(mesh);
      const kind = classifyMeshes(materials);

      switch (kind) {
        case 'transparent':
          mesh.layerMask = TRANSPARENT_LAYER;
          disableTransmission(materials);
          transparent.push(mesh);
          break;
        case 'opaque':
          mesh.layerMask = OPAQUE_LAYER;
          opaque.push(mesh);
          break;
        default:
          mesh.layerMask = OPAQUE_LAYER;
          ignored.push(mesh);
          break;
      }

      // The editor navigates the camera, not the scene hierarchy: freezing the
      // matrices removes thousands of per-frame updates for static GLB scenes.
      mesh.freezeWorldMatrix();
    }

    return { opaque, transparent, ignored };
  }

  dispose(container: AssetContainer | null): void {
    container?.dispose();
  }
}

/** Every material a mesh can draw with, including multi-material submeshes. */
export function materialsForMesh(mesh: AbstractMesh): Material[] {
  const materials = new Set<Material>();
  if (mesh.material) materials.add(mesh.material);

  for (const subMesh of mesh.subMeshes ?? []) {
    const material = subMesh.getMaterial();
    if (material) materials.add(material);
  }

  return [...materials];
}

export function classifyMeshes(materials: readonly Material[]): SceneMeshClass {
  return classifySceneMaterials(materials as readonly SceneMaterialLike[]);
}

/** World-space bounds used to frame the FPS camera. */
export function sceneWorldBounds(
  meshes: readonly AbstractMesh[],
): { min: Vector3; max: Vector3 } | null {
  let min: Vector3 | null = null;
  let max: Vector3 | null = null;

  for (const mesh of meshes) {
    if (mesh.getTotalVertices() === 0) continue;

    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    const meshMin = bounds.minimumWorld;
    const meshMax = bounds.maximumWorld;

    min = min
      ? new Vector3(
          Math.min(min.x, meshMin.x),
          Math.min(min.y, meshMin.y),
          Math.min(min.z, meshMin.z),
        )
      : meshMin.clone();
    max = max
      ? new Vector3(
          Math.max(max.x, meshMax.x),
          Math.max(max.y, meshMax.y),
          Math.max(max.z, meshMax.z),
        )
      : meshMax.clone();
  }

  return min && max ? { min, max } : null;
}

function disableTransmission(materials: readonly Material[]): void {
  for (const material of materials) {
    const surface = (material as SceneMaterialLike).subSurface;
    if (!surface) continue;

    // The overlay has no scene-colour target to refract, and a subsurface
    // prepass would compete with the screen-space G-buffer layout.
    surface.isRefractionEnabled = false;
    surface.isScatteringEnabled = false;
  }
}
