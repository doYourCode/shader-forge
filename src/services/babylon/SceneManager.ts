import type {
  DirectionalLight,
  Engine,
  Mesh,
  Scene,
  ShaderMaterial,
} from '@babylonjs/core';
import type { ShaderError } from '@/core/models/shaderError';
import { parseShaderCompileErrors } from '@/core/utils/shaderErrors';
import type { ShaderLogRecorder } from '@/services/webgl/ShaderLogRecorder';
import { internalShaders } from './internalShaders';
import { FragmentDiagnostics } from './preview/compile/FragmentDiagnostics';
import { ShaderCompiler } from './preview/compile/ShaderCompiler';
import { internalErrorFrom } from './preview/errors/shaderErrorFactory';
import { MaterialController } from './preview/MaterialController';
import { PreviewAnimator } from './preview/PreviewAnimator';
import { PreviewEngine } from './preview/PreviewEngine';
import {
  createPreviewScene,
  type PreviewScene,
} from './preview/createPreviewScene';
import { GlbMeshProvider } from './preview/mesh/GlbMeshProvider';
import type { PreviewMeshProvider } from './preview/mesh/PreviewMeshProvider';

import sphereUrl from '@/assets/meshes/monkey.glb?url';

export interface ShaderSource {
  vertex: string;
  fragment: string;
}

export interface CompileResult {
  ok: boolean;
  message: string;
  errors: ShaderError[];
}

export { assertWebGl2 } from './preview/PreviewEngine';
export type {
  WebGl2EngineLike,
  WebGl2GuardResult,
} from './preview/PreviewEngine';

/** Factories for the collaborators, so tests can substitute them. */
export interface SceneManagerDeps {
  createEngine(reportError: (errors: ShaderError[]) => void): PreviewEngine;
  createScene(engine: Engine, canvas: HTMLCanvasElement): PreviewScene;
  createMaterialController(
    scene: Scene,
    mesh: Mesh,
    onCompileFailure: (source: ShaderSource, fallbackLog: string) => void,
  ): MaterialController;
  createAnimator(
    scene: Scene,
    light: DirectionalLight,
    mesh: Mesh,
    getMaterial: () => ShaderMaterial | null,
  ): PreviewAnimator;
  createCompiler(
    scene: Scene,
    recorder: ShaderLogRecorder | null,
  ): ShaderCompiler;
  createDiagnostics(compiler: ShaderCompiler): FragmentDiagnostics;
}

const defaultDeps: SceneManagerDeps = {
  createEngine: (reportError) => new PreviewEngine(reportError),
  createScene: (engine, canvas) => createPreviewScene(engine, canvas),
  createMaterialController: (scene, mesh, onCompileFailure) =>
    new MaterialController(scene, mesh, onCompileFailure),
  createAnimator: (scene, light, mesh, getMaterial) =>
    new PreviewAnimator(scene, light, mesh, getMaterial),
  createCompiler: (scene, recorder) => new ShaderCompiler(scene, recorder),
  createDiagnostics: (compiler) =>
    new FragmentDiagnostics(compiler, internalShaders.validation.vertex),
};

/**
 * Thin facade that wires the preview collaborators together and keeps the
 * public API of the original monolithic manager.
 */
export class SceneManager {
  private readonly meshProvider: PreviewMeshProvider;
  private readonly deps: SceneManagerDeps;
  private previewEngine: PreviewEngine | null = null;
  private scene: Scene | null = null;
  private mesh: Mesh | null = null;
  private materials: MaterialController | null = null;
  private animator: PreviewAnimator | null = null;
  private compiler: ShaderCompiler | null = null;
  private fragmentDiagnostics: FragmentDiagnostics | null = null;
  private wireframe = false;
  /**
   * Monotonic token identifying the current init session. Any `await` resumes
   * only if its token is still current; dispose or a newer init supersedes it.
   */
  private session = 0;

  onError: (errors: ShaderError[]) => void = () => {};

  constructor(
    meshProvider: PreviewMeshProvider = new GlbMeshProvider(sphereUrl),
    deps: Partial<SceneManagerDeps> = defaultDeps,
  ) {
    this.meshProvider = meshProvider;
    this.deps = {
      createEngine: deps.createEngine ?? defaultDeps.createEngine,
      createScene: deps.createScene ?? defaultDeps.createScene,
      createMaterialController:
        deps.createMaterialController ?? defaultDeps.createMaterialController,
      createAnimator: deps.createAnimator ?? defaultDeps.createAnimator,
      createCompiler: deps.createCompiler ?? defaultDeps.createCompiler,
      createDiagnostics: deps.createDiagnostics ?? defaultDeps.createDiagnostics,
    };
  }

  async init(canvas: HTMLCanvasElement, source: ShaderSource): Promise<void> {
    this.dispose();
    const session = this.session;

    const previewEngine = this.deps.createEngine((errors) =>
      this.onError(errors),
    );
    this.previewEngine = previewEngine;

    const engine = previewEngine.create(canvas);
    if (!engine) {
      this.previewEngine = null;
      return;
    }

    const { scene, directionalLight } = this.deps.createScene(engine, canvas);
    this.scene = scene;
    previewEngine.attachScene(scene);

    let mesh: Mesh;
    try {
      mesh = await this.meshProvider.load(scene);
    } catch (error) {
      // A superseded/disposed init must not tear down a newer session.
      if (!this.isCurrent(session)) return;

      // Bail out cleanly if loading fails.
      this.dispose();
      this.onError([internalErrorFrom(error)]);
      return;
    }

    // If init() was superseded or disposed while we awaited the loader.
    if (!this.isCurrent(session)) {
      mesh.dispose();
      return;
    }

    mesh.name = 'preview';
    this.mesh = mesh;
    this.mesh.rotationQuaternion = null;

    const materials = this.deps.createMaterialController(
      scene,
      mesh,
      (failedSource, fallbackLog) => {
        this.reportCompileFailure(failedSource, fallbackLog);
      },
    );
    this.materials = materials;
    materials.setWireframe(this.wireframe);

    materials.prepareErrorMaterial();
    materials.apply(materials.buildMaterial(source), source);

    const compiler = this.deps.createCompiler(scene, previewEngine.recorder);
    this.compiler = compiler;
    this.fragmentDiagnostics = this.deps.createDiagnostics(compiler);

    const animator = this.deps.createAnimator(
      scene,
      directionalLight,
      mesh,
      () => materials.activeMaterial,
    );
    this.animator = animator;
    animator.start();

    previewEngine.start();
  }

  resize(): void {
    this.previewEngine?.resize();
  }

  async compile(source: ShaderSource): Promise<CompileResult> {
    const session = this.session;
    const mesh = this.mesh;
    const materials = this.materials;
    const compiler = this.compiler;
    const diagnostics = this.fragmentDiagnostics;

    if (
      !this.scene ||
      !mesh ||
      !materials ||
      !compiler ||
      !diagnostics ||
      !this.isCurrent(session)
    ) {
      return { ok: false, message: 'Scene not initialized', errors: [] };
    }

    const attempt = await compiler.tryCompile(source, mesh);

    if (!this.isCurrent(session)) {
      attempt.release(true);
      return { ok: false, message: 'Scene disposed', errors: [] };
    }

    if (attempt.ok && attempt.material) {
      materials.apply(attempt.material, source);
      return { ok: true, message: 'Compiled successfully', errors: [] };
    }

    attempt.release(true);

    let errors = attempt.errors;
    const message =
      errors.length > 0
        ? 'Shader compilation failed'
        : 'Shader program failed to link';

    if (attempt.stage === 'vertex') {
      const fragmentErrors = await diagnostics.collect(source, mesh);
      if (fragmentErrors.length > 0) {
        errors = [...errors, ...fragmentErrors];
      }
    }

    materials.showError();

    return { ok: false, message, errors };
  }

  setWireframe(on: boolean): void {
    this.wireframe = on;
    this.materials?.setWireframe(on);
  }

  setPaused(on: boolean): void {
    this.previewEngine?.setPaused(on);
  }

  dispose(): void {
    this.session += 1;

    this.animator?.dispose();
    this.animator = null;

    this.previewEngine?.stopRenderLoop();

    this.materials?.dispose();
    this.materials = null;

    this.scene?.dispose();
    this.scene = null;

    this.previewEngine?.dispose();
    this.previewEngine = null;

    this.compiler = null;
    this.fragmentDiagnostics = null;
    this.mesh = null;
    // Intentional-for-now: the original manager reset this flag on dispose.
    this.wireframe = false;
  }

  private isCurrent(session: number): boolean {
    return session === this.session;
  }

  private reportCompileFailure(
    source: ShaderSource,
    fallbackLog: string,
  ): void {
    this.materials?.showError();
    this.onError(
      parseShaderCompileErrors(
        this.previewEngine?.recorder?.drain() ?? [],
        source,
        fallbackLog,
      ),
    );
  }
}
