import { Mesh, SceneLoader, type Scene } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { PreviewMeshProvider } from './PreviewMeshProvider';

/** Loads the default preview model from a glTF/GLB asset. */
export class GlbMeshProvider implements PreviewMeshProvider {
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  async load(scene: Scene): Promise<Mesh> {
    const result = await SceneLoader.ImportMeshAsync('', '', this.url, scene);
    const root = result.meshes[0];
    if (!root) throw new Error(`No meshes in GLB: ${this.url}`);

    // Find first actual renderable mesh, keep hierarchy intact
    const mesh = result.meshes.find(
      (m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0,
    );
    if (!mesh) throw new Error(`No renderable mesh in GLB: ${this.url}`);
    return mesh;
  }
}
