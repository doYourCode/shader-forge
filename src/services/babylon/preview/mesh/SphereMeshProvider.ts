import { MeshBuilder, type Mesh, type Scene } from '@babylonjs/core';
import type { PreviewMeshProvider } from './PreviewMeshProvider';

/**
 * The original primitive preview object, kept as an alternative to the GLB
 * model. It is exported for tests and experimentation but is not the default.
 */
export class SphereMeshProvider implements PreviewMeshProvider {
  async load(scene: Scene): Promise<Mesh> {
    return MeshBuilder.CreateSphere(
      'preview',
      { diameter: 2, segments: 24 },
      scene,
    );
  }
}
