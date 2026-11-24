import {
  Color4,
  Scene,
  type AssetContainer,
  type BaseTexture,
  type Engine,
} from '@babylonjs/core';
import { GenerationTracker } from '@/core/async/generation';
import { previewTextureCatalog } from '@/core/constants/previewTextures';
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewScene } from '@/core/models/previewScene';
import type { PostEffectStack, TonemapMode } from '@/core/models/postEffect';
import type { CompileResult } from '@/core/models/compileResult';
import type { GbufferDebugMode } from '@/core/constants/screenSpaceDebug';
import { noopLoadTimer, type LoadTimer } from '@/core/utils/LoadProfiler';
import { PreviewEngine } from '../preview/PreviewEngine';
import {
  EnvironmentController,
  createEnvironmentTexture,
  type EnvironmentBackground,
} from '../preview/EnvironmentController';
import { createNativeEnvironmentIblFilter } from '../preview/IblFiltering';
import { TextureRegistry } from '@/services/userdata/TextureRegistry';
import { UniformBinder } from '@/services/userdata/UniformBinding';
import type { UserDataController } from '@/services/userdata/UserDataController';
import type { ShaderError } from '@/core/models/shaderError';
import type { ShaderLogRecorder } from '@/services/gpu/ShaderLogRecorder';
import { FpsCameraController } from './FpsCameraController';
import {
  SceneAssetProvider,
  OPAQUE_LAYER,
  sceneWorldBounds,
  type LoadedSceneMeshes,
} from './SceneAssetProvider';
import { ScreenSpaceGbuffer } from './ScreenSpaceGbuffer';
import { ScreenSpacePostPipeline } from './ScreenSpacePostPipeline';

export interface ScreenSpaceFrameStats {
  readonly fps: number;
  readonly frameMs: number;
  readonly budgetMs: number;
  readonly width: number;
  readonly height: number;
  readonly drawCalls: number;
}

/** Baseline 60 fps budget; temporal effects must fit inside this. */
const FRAME_BUDGET_MS = 1000 / 60;

export interface ScreenSpaceSceneManagerDeps {
  readonly createEngine: (
    reportError: (errors: ShaderError[]) => void,
  ) => PreviewEngine;
  readonly createScene: (
    engine: Engine,
    canvas: HTMLCanvasElement,
  ) => { scene: Scene; camera: FpsCameraController };
  readonly createEnvironment: (
    scene: Scene,
    timer: LoadTimer,
  ) => EnvironmentController;
  readonly createGbuffer: (
    scene: Scene,
    camera: FpsCameraController['camera'],
    split: LoadedSceneMeshes,
  ) => ScreenSpaceGbuffer;
  readonly createPipeline: (
    scene: Scene,
    camera: FpsCameraController['camera'],
    engine: Engine,
    gbuffer: ScreenSpaceGbuffer,
    textures: TextureRegistry,
    getUserBindings: () => ReturnType<
      UserDataController<BaseTexture>['postBindings']
    >,
    recorder: ShaderLogRecorder | null,
  ) => ScreenSpacePostPipeline;
}

const defaultDeps: ScreenSpaceSceneManagerDeps = {
  createEngine: (reportError) => new PreviewEngine(reportError),
  createScene: (engine, canvas) => createScreenSpaceScene(engine, canvas),
  createEnvironment: (scene, timer) =>
    createEnvironmentController(scene, timer),
  createGbuffer: (scene, camera, split) =>
    new ScreenSpaceGbuffer(scene, camera, split.opaque, split.transparent),
  createPipeline: (
    scene,
    camera,
    engine,
    gbuffer,
    textures,
    getUserBindings,
    recorder,
  ) =>
    new ScreenSpacePostPipeline({
      scene,
      camera,
      engine,
      textures,
      getUserBindings,
      recorder,
      gbuffer,
    }),
};

/** No skybox mesh: the HDRI drives PBR lighting without polluting the G-buffer. */
function createEnvironmentController(
  scene: Scene,
  timer: LoadTimer,
): EnvironmentController {
  const background: EnvironmentBackground = {
    setTexture: () => {},
    dispose: () => {},
  };

  return new EnvironmentController(
    scene,
    createEnvironmentTexture,
    () => background,
    createNativeEnvironmentIblFilter,
    timer,
  );
}

function createScreenSpaceScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
): { scene: Scene; camera: FpsCameraController } {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString('#1a1d23ff');
  scene.skipPointerMovePicking = true;
  // A whole-scene HDRI can easily blow out an outdoor asset; keep the IBL
  // contribution in a range where tonemapping still resolves material detail.
  scene.environmentIntensity = 0.6;

  // The post chain is authored in linear HDR; the display pass owns tone
  // mapping and the sRGB encode. Leaving Babylon's in-material image
  // processing on would tonemap before every effect and hide HDR values.
  scene.imageProcessingConfiguration.isEnabled = false;
  scene.imageProcessingConfiguration.applyByPostProcess = true;

  const camera = new FpsCameraController(scene, { canvas });
  camera.camera.layerMask = OPAQUE_LAYER;
  scene.activeCamera = camera.camera;

  return { scene, camera };
}

/**
 * Facade for the Screen Space editor's whole-scene preview.
 *
 * It is deliberately independent from the surface-shader `SceneManager`: no
 * per-mesh ShaderMaterial, no compiler for vertex/fragment documents, no
 * single-mesh assumption, and no surface-editor state.
 */
export class ScreenSpaceSceneManager {
  private readonly meshProvider: SceneAssetProvider;
  private readonly deps: ScreenSpaceSceneManagerDeps;
  private readonly timer: LoadTimer;
  private readonly sessions = new GenerationTracker();
  private previewEngine: PreviewEngine | null = null;
  private scene: Scene | null = null;
  private camera: FpsCameraController | null = null;
  private environment: EnvironmentController | null = null;
  private container: AssetContainer | null = null;
  private split: LoadedSceneMeshes = {
    opaque: [],
    transparent: [],
    ignored: [],
  };
  private gbuffer: ScreenSpaceGbuffer | null = null;
  private pipeline: ScreenSpacePostPipeline | null = null;
  private textures: TextureRegistry | null = null;
  private userData: UserDataController<BaseTexture> | null = null;
  private frameStartedAt = 0;

  onError: (errors: ShaderError[]) => void = () => {};
  onStats: (stats: ScreenSpaceFrameStats) => void = () => {};
  onLoading: (
    message: { key: string; params?: Record<string, unknown> } | null,
  ) => void = () => {};

  constructor(
    deps: Partial<ScreenSpaceSceneManagerDeps> = defaultDeps,
    meshProvider: SceneAssetProvider = new SceneAssetProvider(),
    timer: LoadTimer = noopLoadTimer,
  ) {
    this.deps = { ...defaultDeps, ...deps };
    this.meshProvider = meshProvider;
    this.timer = timer;
  }

  async init(
    canvas: HTMLCanvasElement,
    sceneAsset: PreviewScene,
    hdri: PreviewHdri,
    postStack: PostEffectStack,
    userData: UserDataController<BaseTexture> | null = null,
  ): Promise<void> {
    this.dispose();
    this.userData = userData;
    const session = this.sessions.begin();

    const previewEngine = this.deps.createEngine((errors) =>
      this.onError(errors),
    );
    this.previewEngine = previewEngine;

    const engine = previewEngine.create(canvas);
    if (!engine) {
      this.previewEngine = null;
      return;
    }

    const { scene, camera } = this.deps.createScene(engine, canvas);
    this.scene = scene;
    this.camera = camera;
    previewEngine.attachScene(scene);

    this.onLoading({ key: 'screenSpace.loading.scene' });
    const environment = this.deps.createEnvironment(scene, this.timer);
    this.environment = environment;
    const environmentReady = environment.load(hdri);

    let container: AssetContainer;
    try {
      container = await this.meshProvider.load(
        scene,
        sceneAsset,
        (loaded, total) => {
          this.onLoading({
            key: 'screenSpace.loading.sceneProgress',
            params: {
              loaded: Math.round(loaded / 1024 / 1024),
              total: Math.max(Math.round(total / 1024 / 1024), 1),
            },
          });
        },
      );
    } catch (error) {
      if (!session.isCurrent()) return;
      this.dispose();
      this.onError([internalSceneError(error)]);
      return;
    }

    if (!session.isCurrent()) {
      container.dispose();
      return;
    }

    this.container = container;
    this.split = this.meshProvider.prepare(container);

    const bounds = sceneWorldBounds([
      ...this.split.opaque,
      ...this.split.transparent,
    ]);
    if (bounds) camera.frame(bounds.min, bounds.max);

    const textures = new TextureRegistry(scene, previewTextureCatalog.find);
    this.textures = textures;
    const binder = new UniformBinder(textures);
    userData?.attachGpu({ textures, binder });

    const gbuffer = this.deps.createGbuffer(scene, camera.camera, this.split);
    this.gbuffer = gbuffer;
    if (!gbuffer.supported) {
      this.onError([gbufferUnsupportedError()]);
      this.dispose();
      return;
    }

    const pipeline = this.deps.createPipeline(
      scene,
      camera.camera,
      engine,
      gbuffer,
      textures,
      () => userData?.postBindings() ?? [],
      previewEngine.recorder,
    );
    this.pipeline = pipeline;

    scene.onBeforeRenderObservable.add(() => {
      this.frameStartedAt = performance.now();
    });
    scene.onAfterRenderObservable.add(() => this.reportStats(engine));

    const compile = await pipeline.compile(postStack);
    if (!session.isCurrent()) return;
    if (compile.status === 'failed') {
      this.onError([...compile.errors]);
      // Keep a usable preview: the display pass still shows the HDR scene with
      // the output transform even when the user's effect stack is broken.
      await pipeline.compile({ effects: [], tonemap: postStack.tonemap });
    }

    this.onLoading({ key: 'screenSpace.loading.environment' });
    await environmentReady;
    if (!session.isCurrent()) return;

    this.onLoading(null);
    previewEngine.start();
  }

  /** Swaps the scene while keeping the camera controls and effect chain. */
  async loadScene(sceneAsset: PreviewScene): Promise<boolean> {
    const scene = this.scene;
    const session = this.sessions.current();
    if (!scene || !session.isCurrent()) return false;

    this.onLoading({ key: 'screenSpace.loading.scene' });
    let container: AssetContainer;
    try {
      container = await this.meshProvider.load(scene, sceneAsset);
    } catch (error) {
      if (session.isCurrent()) this.onError([internalSceneError(error)]);
      this.onLoading(null);
      return false;
    }

    if (!session.isCurrent()) {
      container.dispose();
      return false;
    }

    this.container?.dispose();
    this.container = container;
    this.split = this.meshProvider.prepare(container);
    this.gbuffer?.setMeshes(this.split.opaque, this.split.transparent);

    const bounds = sceneWorldBounds([
      ...this.split.opaque,
      ...this.split.transparent,
    ]);
    if (bounds) this.camera?.frame(bounds.min, bounds.max);

    this.onLoading(null);
    return true;
  }

  loadEnvironment(hdri: PreviewHdri): Promise<boolean> {
    return this.environment?.load(hdri) ?? Promise.resolve(false);
  }

  compilePostEffects(stack: PostEffectStack): Promise<CompileResult> {
    const pipeline = this.pipeline;
    if (!pipeline || !this.sessions.current().isCurrent()) {
      return Promise.resolve({
        status: 'unavailable',
        reason: 'scene-not-initialized',
      });
    }

    return pipeline.compile(stack);
  }

  setTonemap(mode: TonemapMode): void {
    this.pipeline?.setTonemap(mode);
  }

  setDebugMode(mode: GbufferDebugMode): void {
    this.pipeline?.setDebugMode(mode);
  }

  resize(): void {
    this.previewEngine?.resize();
    this.pipeline?.resize();
  }

  setPaused(paused: boolean): void {
    this.previewEngine?.setPaused(paused);
  }

  dispose(): void {
    this.sessions.invalidate();

    this.userData?.attachGpu(null);
    this.userData = null;

    this.pipeline?.dispose();
    this.pipeline = null;

    this.gbuffer?.dispose();
    this.gbuffer = null;

    this.environment?.dispose();
    this.environment = null;

    this.textures?.dispose();
    this.textures = null;

    this.container?.dispose();
    this.container = null;
    this.split = { opaque: [], transparent: [], ignored: [] };

    this.previewEngine?.stopRenderLoop();
    this.camera?.dispose();
    this.camera = null;
    this.scene?.dispose();
    this.scene = null;

    this.previewEngine?.dispose();
    this.previewEngine = null;
  }

  private reportStats(engine: Engine): void {
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const frameMs = performance.now() - this.frameStartedAt;
    const counters = (
      engine as unknown as {
        _drawCalls?: { current?: number };
      }
    )._drawCalls;
    this.onStats({
      fps: engine.getFps(),
      frameMs,
      budgetMs: FRAME_BUDGET_MS,
      width,
      height,
      drawCalls: counters?.current ?? this.scene?.getActiveMeshes().length ?? 0,
    });
  }
}

function internalSceneError(error: unknown): ShaderError {
  return {
    stage: 'program',
    line: null,
    column: null,
    kind: 'internal',
    title: 'Scene failed to load',
    message: error instanceof Error ? error.message : String(error),
    advice: 'Check the GLB asset and reload the screen-space editor.',
  };
}

function gbufferUnsupportedError(): ShaderError {
  return {
    stage: 'program',
    line: null,
    column: null,
    kind: 'internal',
    title: 'G-buffer is unavailable',
    message:
      'This device does not expose Babylon PrePass/MRT support, which the screen-space G-buffer requires.',
    advice: 'Use a WebGL 2 device with multiple render targets.',
  };
}
