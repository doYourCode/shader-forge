import { ShaderMaterial, type Mesh, type Scene } from '@babylonjs/core';

import {
  SHADER_ATTRIBUTES,
  SHADER_SAMPLERS,
  SHADER_UNIFORMS,
} from '@/core/constants/materialAbi';
import {
  type MaterialExtras,
  type ShaderSource,
} from '@/core/models/shaderSource';

import { internalShaders } from '../internalShaders';

const ERROR_MATERIAL_NAME = 'previewErrorShader';
const DEFAULT_MATERIAL_NAME = 'previewShader';
const ERROR_PREWARM_FRAMES = 120;

/**
 * The single place user shader materials are constructed. Both the init path
 * and the compiler use it, so their options cannot diverge.
 *
 * User-defined uniforms/samplers arrive on the source (it is a material
 * blueprint at compile time) and are spread-appended into fresh copies; the
 * shared ABI lists are never mutated.
 */
export function buildShaderMaterial(
  scene: Scene,
  source: ShaderSource & MaterialExtras,
  name = DEFAULT_MATERIAL_NAME,
  wireframe = false,
): ShaderMaterial {
  const material = new ShaderMaterial(
    name,
    scene,
    {
      vertexSource: source.vertex,
      fragmentSource: source.fragment,
    },
    {
      attributes: [...SHADER_ATTRIBUTES],
      uniforms: [...SHADER_UNIFORMS, ...(source.extraUniforms ?? [])],
      samplers: [...SHADER_SAMPLERS, ...(source.extraSamplers ?? [])],
    },
    false,
  );

  material.wireframe = wireframe;
  return material;
}

/**
 * Owns the preview's materials: the active shader material, the lazily created
 * error material, the wireframe flag and the error-material prewarm loop.
 */
export class MaterialController {
  private readonly scene: Scene;
  private meshes: Mesh[];
  private readonly onCompileFailure: (
    source: ShaderSource,
    fallbackLog: string,
  ) => void;
  private material: ShaderMaterial | null = null;
  private errorMaterial: ShaderMaterial | null = null;
  private wireframe = false;
  private disposed = false;
  private showingError = false;
  private errorPrewarmFrame: number | null = null;

  constructor(
    scene: Scene,
    mesh: Mesh,
    onCompileFailure: (source: ShaderSource, fallbackLog: string) => void,
  ) {
    this.scene = scene;
    // TODO: apply materials to child meshes too (would change the current
    // visuals, so the default stays the single provider mesh).
    this.meshes = [mesh];
    this.onCompileFailure = onCompileFailure;
  }

  /** The material currently driving the mesh, not the error material. */
  get activeMaterial(): ShaderMaterial | null {
    return this.material;
  }

  buildMaterial(
    source: ShaderSource,
    name = DEFAULT_MATERIAL_NAME,
  ): ShaderMaterial {
    return buildShaderMaterial(this.scene, source, name, this.wireframe);
  }

  /**
   * Installs a material on the target mesh and retires the previous one.
   * The order (wireframe, error callback, swap, dispose) is intentional.
   */
  apply(material: ShaderMaterial, source: ShaderSource): void {
    if (this.meshes.length === 0) {
      material.dispose();
      return;
    }

    const previous = this.material;

    material.wireframe = this.wireframe;
    material.onError = (_effect, rawErrors) => {
      this.onCompileFailure(source, rawErrors);
    };

    this.material = material;
    this.showingError = false;
    for (const mesh of this.meshes) {
      mesh.material = material;
    }
    previous?.dispose();
  }

  /**
   * Rebinds the controller to replacement geometry while keeping the currently
   * displayed material (including the error material).
   */
  setMesh(mesh: Mesh): void {
    this.meshes = [mesh];

    const material = this.showingError
      ? (this.errorMaterial ?? this.material)
      : this.material;

    if (material) {
      mesh.material = material;
    }
  }

  prepareErrorMaterial(): void {
    const material = this.ensureErrorMaterial();
    if (
      !material ||
      this.meshes.length === 0 ||
      this.errorPrewarmFrame !== null
    ) {
      return;
    }

    let frames = 0;
    const warm = () => {
      this.errorPrewarmFrame = null;
      if (this.disposed || this.meshes.length === 0 || !this.errorMaterial) {
        return;
      }

      if (this.errorMaterial.isReady(this.meshes[0])) return;
      if (frames++ >= ERROR_PREWARM_FRAMES) return;

      this.errorPrewarmFrame = requestAnimationFrame(warm);
    };

    this.errorPrewarmFrame = requestAnimationFrame(warm);
  }

  showError(): void {
    if (this.meshes.length === 0) return;

    const material = this.ensureErrorMaterial();
    if (!material) return;

    this.showingError = true;
    material.wireframe = this.wireframe;
    for (const mesh of this.meshes) {
      mesh.material = material;
    }
  }

  setWireframe(on: boolean): void {
    this.wireframe = on;
    if (this.material) {
      this.material.wireframe = on;
    }
    if (this.errorMaterial) {
      this.errorMaterial.wireframe = on;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.showingError = false;

    if (this.errorPrewarmFrame !== null) {
      cancelAnimationFrame(this.errorPrewarmFrame);
      this.errorPrewarmFrame = null;
    }

    this.material?.dispose();
    this.errorMaterial?.dispose();
    this.material = null;
    this.errorMaterial = null;
  }

  private ensureErrorMaterial(): ShaderMaterial | null {
    // After disposal the original manager no longer had a mesh, so showing the
    // error material was a no-op. Keep that outcome without touching a
    // disposed scene.
    if (this.disposed) return null;

    if (!this.errorMaterial) {
      this.errorMaterial = new ShaderMaterial(
        ERROR_MATERIAL_NAME,
        this.scene,
        {
          vertexSource: internalShaders.error.vertex,
          fragmentSource: internalShaders.error.fragment,
        },
        {
          attributes: ['position'],
          uniforms: ['worldViewProjection'],
        },
        false,
      );
      this.errorMaterial.wireframe = this.wireframe;
    }

    return this.errorMaterial;
  }
}
