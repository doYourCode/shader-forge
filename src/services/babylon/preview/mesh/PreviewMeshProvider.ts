import type { Mesh, Scene } from '@babylonjs/core';

/** Supplies the mesh the preview renders and animates. */
export interface PreviewMeshProvider {
  load(scene: Scene): Promise<Mesh>;
}
