import type {
  DirectionalLight,
  Engine,
  Mesh,
  Scene,
  ShaderMaterial,
} from '@babylonjs/core';
import { CreateScreenshotUsingRenderTargetAsync } from '@babylonjs/core/Misc/screenshotTools';
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
import type {
  CompileResult,
  MaterialBlueprint,
  PostEffectStack,
  ShaderSource,
} from './preview/PreviewTypes';
import {
  PostEffectPipeline,
  type PostEffectPipelineDeps,
} from './preview/post/PostEffectPipeline';
import type { TonemapMode } from '@/core/models/postEffect';
import {
  createPreviewScene,
  type PreviewScene,
} from './preview/createPreviewScene';
import { GlbMeshProvider } from './preview/mesh/GlbMeshProvider';
import type { PreviewMeshProvider } from './preview/mesh/PreviewMeshProvider';
import { previewModels } from '@/core/constants/previewModels';
import { previewHdris } from '@/core/constants/previewHdris';
import { previewTextureCatalog } from '@/core/constants/previewTextures';
import type { PreviewModel } from '@/core/models/previewModel';
import type { PreviewHdri } from '@/core/models/previewHdri';
import {
  createDefaultEnvironmentController,
  type EnvironmentController,
} from './preview/EnvironmentController';
import { noopLoadTimer, type LoadTimer } from '@/services/perf/LoadProfiler';
import {
  TextureRegistry,
  type TextureRegistryPort,
} from '@/services/userdata/TextureRegistry';
import {
  ShaderMaterialBindingTarget,
  UniformBinder,
  type UniformBindingTarget,
  type UniformBinderPort,
} from '@/services/userdata/UniformBinder';
import type { UserDataController } from '@/services/userdata/UserDataController';

export { assertWebGl2 } from './preview/PreviewEngine';
export type {
  WebGl2EngineLike,
  WebGl2GuardResult,
} from './preview/PreviewEngine';
export type {
  CompileResult,
  MaterialBlueprint,
  PostEffectDocument,
  PostEffectSource,
  PostEffectStack,
  ShaderSource,
  TonemapMode,
} from './preview/PreviewTypes';

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
  createEnvironmentController(
    scene: Scene,
    timer: LoadTimer,
  ): EnvironmentController;
  createTextureRegistry(scene: Scene): TextureRegistryPort;
  createUniformBinder(textures: TextureRegistryPort): UniformBinderPort;
  createUniformBindingTarget(material: ShaderMaterial): UniformBindingTarget;
  createPostEffects(
    deps: PostEffectPipelineDeps,
    mesh: Mesh,
  ): PostEffectPipeline;
}

export type PreviewMeshProviderFactory = (
  model: PreviewModel,
) => PreviewMeshProvider;

const defaultMeshProviderFactory: PreviewMeshProviderFactory = (model) =>
  new GlbMeshProvider(model.url);

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
  createEnvironmentController: (scene, timer) =>
    createDefaultEnvironmentController(scene, timer),
  createTextureRegistry: (scene) =>
    new TextureRegistry(scene, previewTextureCatalog.find),
  createUniformBinder: (textures) => new UniformBinder(textures),
  createUniformBindingTarget: (material) =>
    new ShaderMaterialBindingTarget(material),
  createPostEffects: (deps, mesh) => new PostEffectPipeline(deps, mesh),
};

/**
 * Thin facade that wires the preview collaborators together and keeps the
 * public API of the original monolithic manager.
 */
export class SceneManager {
  private readonly meshProviderFactory: PreviewMeshProviderFactory;
  private readonly deps: SceneManagerDeps;
  private readonly timer: LoadTimer;
  private previewEngine: PreviewEngine | null = null;
  private scene: Scene | null = null;
  private mesh: Mesh | null = null;
  private model: PreviewModel | null = null;
  private materials: MaterialController | null = null;
  private animator: PreviewAnimator | null = null;
  private compiler: ShaderCompiler | null = null;
  private fragmentDiagnostics: FragmentDiagnostics | null = null;
  private environment: EnvironmentController | null = null;
  private textures: TextureRegistryPort | null = null;
  private userData: UserDataController | null = null;
  private postEffects: PostEffectPipeline | null = null;
  private wireframe = false;
  /**
   * Monotonic token identifying the current init session. Any `await` resumes
   * only if its token is still current; dispose or a newer init supersedes it.
   */
  private session = 0;
  /** Separately cancels in-flight model swaps inside the current session. */
  private modelRequest = 0;

  onError: (errors: ShaderError[]) => void = () => {};

  constructor(
    meshProviderFactory: PreviewMeshProviderFactory = defaultMeshProviderFactory,
    deps: Partial<SceneManagerDeps> = defaultDeps,
    /**
     * Optional load-phase instrumentation. The composition root supplies a real
     * profiler; tests and production defaults get the no-op timer.
     */
    timer: LoadTimer = noopLoadTimer,
  ) {
    this.meshProviderFactory = meshProviderFactory;
    this.deps = {
      createEngine: deps.createEngine ?? defaultDeps.createEngine,
      createScene: deps.createScene ?? defaultDeps.createScene,
      createMaterialController:
        deps.createMaterialController ?? defaultDeps.createMaterialController,
      createAnimator: deps.createAnimator ?? defaultDeps.createAnimator,
      createCompiler: deps.createCompiler ?? defaultDeps.createCompiler,
      createDiagnostics:
        deps.createDiagnostics ?? defaultDeps.createDiagnostics,
      createEnvironmentController:
        deps.createEnvironmentController ??
        defaultDeps.createEnvironmentController,
      createTextureRegistry:
        deps.createTextureRegistry ?? defaultDeps.createTextureRegistry,
      createUniformBinder:
        deps.createUniformBinder ?? defaultDeps.createUniformBinder,
      createUniformBindingTarget:
        deps.createUniformBindingTarget ??
        defaultDeps.createUniformBindingTarget,
      createPostEffects:
        deps.createPostEffects ?? defaultDeps.createPostEffects,
    };
    this.timer = timer;
  }

  async init(
    canvas: HTMLCanvasElement,
    blueprint: MaterialBlueprint,
    model: PreviewModel = previewModels.default,
    hdri: PreviewHdri = previewHdris.default,
    userData: UserDataController | null = null,
    postStack: PostEffectStack | null = null,
  ): Promise<void> {
    this.dispose();
    this.userData = userData;
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

    const { scene, camera, directionalLight } = this.deps.createScene(
      engine,
      canvas,
    );
    this.scene = scene;
    previewEngine.attachScene(scene);

    // The user-data registry/binder are scene-scoped: textures die with the
    // scene, while the controller (and its document) outlives it.
    const textures = this.deps.createTextureRegistry(scene);
    const binder = this.deps.createUniformBinder(textures);
    this.textures = textures;
    userData?.attachGpu({ textures, binder });

    const environment = this.deps.createEnvironmentController(
      scene,
      this.timer,
    );
    this.environment = environment;
    // The environment loads in parallel with the mesh; the scene keeps using
    // its current environment until the texture is ready. Init only settles
    // once it is in, so the loading overlay covers the whole sequence.
    const environmentReady = environment.load(hdri);

    let mesh: Mesh;
    try {
      mesh = await this.timer.measure('mesh:load', () =>
        this.meshProviderFactory(model).load(scene),
      );
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
    this.model = model;
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
    materials.apply(materials.buildMaterial(blueprint), blueprint);
    this.applyUserDataBindings();

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

    if (postStack) {
      const postEffects = this.deps.createPostEffects(
        {
          scene,
          camera,
          engine,
          textures,
          getUserBindings: () => this.userData?.postBindings() ?? [],
          recorder: previewEngine.recorder,
        },
        mesh,
      );
      this.postEffects = postEffects;
      void this.compileInitialPostEffects(postStack, session);
    }

    // Frames may already be drawing (mountCanvas unpauses the engine so the
    // canvas is cleared while assets load), but init only completes — and the
    // loading overlay only hides once the environment is ready as well.

    await environmentReady;
    if (!this.isCurrent(session)) return;

    previewEngine.start();
  }

  /**
   * Swaps the preview geometry while keeping the active material, wireframe
   * state, animation, and compiler bound to the current scene.
   */
  async loadModel(model: PreviewModel): Promise<boolean> {
    if (model.id === this.model?.id) {
      // Selecting the displayed model also cancels a swap that is still loading.
      this.modelRequest += 1;
      return true;
    }

    const scene = this.scene;
    const currentMesh = this.mesh;
    const materials = this.materials;

    if (!scene || !currentMesh || !materials) return false;

    const session = this.session;
    const request = ++this.modelRequest;

    let nextMesh: Mesh;
    try {
      nextMesh = await this.timer.measure('mesh:load', () =>
        this.meshProviderFactory(model).load(scene),
      );
    } catch (error) {
      if (!this.isCurrent(session) || request !== this.modelRequest) {
        return false;
      }

      this.onError([internalErrorFrom(error)]);
      return false;
    }

    if (!this.isCurrent(session) || request !== this.modelRequest) {
      nextMesh.dispose();
      return false;
    }

    nextMesh.name = 'preview';
    nextMesh.rotationQuaternion = null;

    materials.setMesh(nextMesh);
    this.animator?.setMesh(nextMesh);
    this.postEffects?.setMesh(nextMesh);
    currentMesh.dispose();

    this.mesh = nextMesh;
    this.model = model;
    return true;
  }

  /**
   * Applies an HDRI to the preview scene. The current environment stays active
   * until the new texture has loaded, and only the latest request can win.
   */
  loadEnvironment(hdri: PreviewHdri): Promise<boolean> {
    const environment = this.environment;
    if (!environment) return Promise.resolve(false);

    return environment.load(hdri);
  }

  resize(): void {
    this.previewEngine?.resize();
    this.postEffects?.resize();
  }

  async compile(blueprint: MaterialBlueprint): Promise<CompileResult> {
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

    const attempt = await this.timer.measure('shader:compile', () =>
      compiler.tryCompile(blueprint, mesh),
    );

    if (!this.isCurrent(session)) {
      attempt.release(true);
      return { ok: false, message: 'Scene disposed', errors: [] };
    }

    if (attempt.ok && attempt.material) {
      materials.apply(attempt.material, blueprint);
      this.applyUserDataBindings();
      return { ok: true, message: 'Compiled successfully', errors: [] };
    }

    attempt.release(true);

    let errors = attempt.errors;
    const message =
      errors.length > 0
        ? 'Shader compilation failed'
        : 'Shader program failed to link';

    if (attempt.stage === 'vertex') {
      const fragmentErrors = await diagnostics.collect(blueprint, mesh);
      if (fragmentErrors.length > 0) {
        errors = [...errors, ...fragmentErrors];
      }
    }

    materials.showError();

    return { ok: false, message, errors };
  }

  /**
   * Compiles the enabled view-space effect stack and, on success, installs it
   * as one unit. A failed compile leaves the previous chain rendering, so the
   * last working image (and the last working effect set) is preserved.
   */
  async compilePostEffects(stack: PostEffectStack): Promise<CompileResult> {
    const pipeline = this.postEffects;
    const session = this.session;

    if (!pipeline || !this.isCurrent(session)) {
      return { ok: false, message: 'Scene not initialized', errors: [] };
    }

    const result = await pipeline.compile(stack);

    if (!this.isCurrent(session) || this.postEffects !== pipeline) {
      return { ok: false, message: 'Scene disposed', errors: [] };
    }

    return result;
  }

  /** Output transform only; the display pass reads it without recompiling. */
  setTonemap(mode: TonemapMode): void {
    this.postEffects?.setTonemap(mode);
  }

  /**
   * First compile of a stack handed to `init`. Its outcome is reported through
   * `onError` because init has already resolved by the time the driver answers.
   */
  private async compileInitialPostEffects(
    stack: PostEffectStack,
    session: number,
  ): Promise<void> {
    const pipeline = this.postEffects;
    if (!pipeline) return;

    const result = await pipeline.compile(stack);
    if (!this.isCurrent(session) || this.postEffects !== pipeline) return;

    if (!result.ok && result.errors.length > 0) {
      this.onError(result.errors);
    }
  }

  /**
   * Renders the current scene to an image and returns it as a data URL.
   *
   * Used by the example thumbnail baker (`npm run bake:examples`), so a baked
   * preview comes from the exact pipeline the editor renders instead of a
   * second Babylon setup that could drift.
   */
  async snapshot(
    width: number,
    height: number,
    mimeType = 'image/webp',
  ): Promise<string | null> {
    const scene = this.scene;
    const mesh = this.mesh;
    const material = this.materials?.activeMaterial ?? null;
    const camera = scene?.activeCamera ?? null;

    if (!scene || !mesh || !material || !camera) return null;

    // A screenshot taken before the effect compiled would capture the blank
    // scene (or the error material), which is worse than reporting no image.
    const ready = await waitForMaterial(material, mesh);
    if (!ready) return null;

    return CreateScreenshotUsingRenderTargetAsync(
      scene.getEngine(),
      camera,
      { width, height, precision: 1 },
      mimeType,
      4,
      true,
    );
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
    this.modelRequest += 1;

    // Detach before the scene dies: the controller keeps its document but must
    // never hold a registry or binder from a disposed scene.
    this.userData?.attachGpu(null);
    this.userData = null;

    this.animator?.dispose();
    this.animator = null;

    this.environment?.dispose();
    this.environment = null;

    this.previewEngine?.stopRenderLoop();

    this.postEffects?.dispose();
    this.postEffects = null;

    this.materials?.dispose();
    this.materials = null;

    this.textures?.dispose();
    this.textures = null;

    this.scene?.dispose();
    this.scene = null;

    this.previewEngine?.dispose();
    this.previewEngine = null;

    this.compiler = null;
    this.fragmentDiagnostics = null;
    this.mesh = null;
    this.model = null;
    // Intentional-for-now: the original manager reset this flag on dispose.
    this.wireframe = false;
  }

  private isCurrent(session: number): boolean {
    return session === this.session;
  }

  /**
   * Re-attaches the binder to the material a compile/init just installed and
   * re-applies the document values. Called after every `apply`.
   */
  private applyUserDataBindings(): void {
    const userData = this.userData;
    const material = this.materials?.activeMaterial ?? null;

    if (!userData || !material) return;

    userData.onMaterialApplied(this.deps.createUniformBindingTarget(material));
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

/** Upper bound for the shader warm-up; a broken effect must not hang a bake. */
const MAX_SNAPSHOT_WARMUP_FRAMES = 120;

/**
 * Waits for the active effect to compile, resolving `false` when the warm-up
 * budget is exhausted. The render loop keeps drawing, but a screenshot taken
 * before the effect is ready would capture the blank scene.
 */
function waitForMaterial(
  material: ShaderMaterial,
  mesh: Mesh,
): Promise<boolean> {
  return new Promise((resolve) => {
    let frame = 0;

    const check = (): void => {
      if (material.isReady(mesh)) {
        resolve(true);
        return;
      }

      if (frame >= MAX_SNAPSHOT_WARMUP_FRAMES) {
        resolve(false);
        return;
      }

      frame += 1;
      requestAnimationFrame(check);
    };

    check();
  });
}
