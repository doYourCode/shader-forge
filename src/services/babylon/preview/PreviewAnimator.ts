import type {
  DirectionalLight,
  Mesh,
  Observer,
  Scene,
  ShaderMaterial,
} from '@babylonjs/core';
import { SHADER_SAMPLER_NAMES, SHADER_UNIFORM_NAMES } from './MaterialController';
import { Matrix } from '@babylonjs/core';
import { updateNormalMatrix } from './mesh/MeshMatricesProc';

/**
 * Drives the animated shader uniforms and the mesh spin once per rendered
 * frame. Rotation is deliberately frame-based (not delta-time) so the visual
 * speed matches the original implementation.
 */
export class PreviewAnimator {
  private readonly scene: Scene;
  private readonly light: DirectionalLight;
  private mesh: Mesh;
  private readonly getMaterial: () => ShaderMaterial | null;
  private observer: Observer<Scene> | null = null;
  private readonly inverseWorldMatrix = Matrix.Identity();
  private readonly normalMatrix = Matrix.Identity();

  constructor(
    scene: Scene,
    light: DirectionalLight,
    mesh: Mesh,
    getMaterial: () => ShaderMaterial | null,
  ) {
    this.scene = scene;
    this.light = light;
    this.mesh = mesh;
    this.getMaterial = getMaterial;
  }

  /** Rebinds the animation to replacement geometry without restarting it. */
  setMesh(mesh: Mesh): void {
    this.mesh = mesh;
  }

  start(): void {
    // `registerBeforeRender` returns void, so the observable API is used to
    // keep a handle that dispose() can remove.
    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
  }

  dispose(): void {
    if (!this.observer) return;

    this.scene.onBeforeRenderObservable.remove(this.observer);
    this.observer = null;
  }

  private update(): void {
    const material = this.getMaterial();
    if (!material || !this.scene.activeCamera) return;

    material.setFloat(SHADER_UNIFORM_NAMES.time, performance.now() * 0.001);
    material.setVector3(SHADER_UNIFORM_NAMES.cameraPos,this.scene.activeCamera.position);
    material.setVector3(SHADER_UNIFORM_NAMES.lightDir,this.light.direction);

    // Keep the shader reflection in sync with the environment selected in the
    // viewer, including after an HDRI swap or a successful recompile.
    if (this.scene.environmentTexture) {
      material.setTexture(
        SHADER_SAMPLER_NAMES.environment,
        this.scene.environmentTexture,
      );
    }

    // set the normal matrix here
        updateNormalMatrix(
      this.mesh,
      material,
      this.inverseWorldMatrix,
      this.normalMatrix,
    );

    this.mesh.rotation.y += 0.001;
  }
}
