import {
  Color4,
  Scene,
  type AssetContainer,
  type BaseTexture,
  type Engine,
} from '@babylonjs/core';
import { GenerationTracker } from '@/core/async/generation';
import {
  DEFAULT_RENDER_SCALE_POLICY,
  blendFrameTime,
  hardwareScalingLevel,
  nextRenderScale,
} from '@/core/screenspace/renderScale';
import { previewTextureCatalog } from '@/core/constants/previewTextures';
import {
  DEFAULT_ENVIRONMENT_INTENSITY,
  DEFAULT_SUN_INTENSITY,
} from '@/core/constants/screenSpaceRender';
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
import { SunController } from './SunController';

/** The sun surface the manager needs; the concrete controller is injectable. */
export interface ScreenSpaceSun {
  bind(meshes: LoadedSceneMeshes): void;
  setIntensity(intensity: number): void;
  dispose(): void;
}

export interface ScreenSpaceFrameStats {
  readonly fps: number;
  readonly frameMs: number;
  readonly budgetMs: number;
  readonly width: number;
  readonly height: number;
  readonly drawCalls: number;
  /** Canvas resolution fraction after adaptive scaling (1 = native). */
  readonly renderScale: number;
}

/** Baseline 60 fps budget; temporal effects must fit inside this. */
const FRAME_BUDGET_MS = 1000 / 60;

/** Frames between adaptive-resolution decisions (~0.5 s at 60 fps). */
const RENDER_SCALE_SAMPLE_FRAMES = 30;

/** A stall (compile, tab switch) must not unbalance the average. */
const MAX_FRAME_SAMPLE_MS = 100;

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
  readonly createSun: (
    scene: Scene,
    camera: FpsCameraController['camera'],
    intensity: number,
  ) => ScreenSpaceSun;
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
  createSun: (scene, camera, intensity) =>
    new SunController(scene, camera, intensity),
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
  scene.environmentIntensity = DEFAULT_ENVIRONMENT_INTENSITY;

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
  private sun: ScreenSpaceSun | null = null;
  private sunIntensity = DEFAULT_SUN_INTENSITY;
  private environmentIntensity = DEFAULT_ENVIRONMENT_INTENSITY;
  private frameStartedAt = 0;
  private renderScale = DEFAULT_RENDER_SCALE_POLICY.max;
  private pendingRenderScale: number | null = null;
  private scaleSamplesToSkip = 0;
  private averageFrameMs = DEFAULT_RENDER_SCALE_POLICY.targetFrameMs;
  private framesUntilScaleUpdate = RENDER_SCALE_SAMPLE_FRAMES;

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

    // A fresh engine always starts at its native resolution.
    this.renderScale = DEFAULT_RENDER_SCALE_POLICY.max;
    this.pendingRenderScale = null;
    this.scaleSamplesToSkip = 0;
    this.averageFrameMs = DEFAULT_RENDER_SCALE_POLICY.targetFrameMs;
    this.framesUntilScaleUpdate = RENDER_SCALE_SAMPLE_FRAMES;

    const { scene, camera } = this.deps.createScene(engine, canvas);
    this.scene = scene;
    this.camera = camera;
    // The overlay may hold a value from before the scene existed.
    scene.environmentIntensity = this.environmentIntensity;
    previewEngine.attachScene(scene);

    // The sun must exist before the PBR materials compile: the light count and
    // SHADOW defines are part of every material's effect key.
    this.sun = this.deps.createSun(scene, camera.camera, this.sunIntensity);

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
    // Casters/receivers must be known before the first frame draws the meshes,
    // because `receiveShadows` is read when the PBR effect is built.
    this.sun?.bind(this.split);

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
      // Apply a pending resolution change before drawing, never after the
      // final post-process pass: resizing the canvas clears its buffer.
      this.applyPendingRenderScale();
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
    this.holdRenderScale();
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
    this.sun?.bind(this.split);
    this.holdRenderScale();
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

    this.holdRenderScale();
    return pipeline.compile(stack).finally(() => this.holdRenderScale());
  }

  setTonemap(mode: TonemapMode): void {
    this.pipeline?.setTonemap(mode);
  }

  setDebugMode(mode: GbufferDebugMode): void {
    // A debug view can rebuild the PrePass; do not turn that stall into an
    // automatic resolution drop.
    this.holdRenderScale();
    this.pipeline?.setDebugMode(mode);
  }

  /** Direct sun intensity; stored so a late scene picks the value up. */
  setSunIntensity(intensity: number): void {
    this.sunIntensity = intensity;
    this.sun?.setIntensity(intensity);
  }

  /** Environment (HDRI) intensity, applied as-is to the Babylon scene. */
  setEnvironmentIntensity(intensity: number): void {
    this.environmentIntensity = intensity;
    if (this.scene) this.scene.environmentIntensity = intensity;
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
    this.pendingRenderScale = null;
    this.scaleSamplesToSkip = 0;

    this.userData?.attachGpu(null);
    this.userData = null;

    this.pipeline?.dispose();
    this.pipeline = null;

    this.gbuffer?.dispose();
    this.gbuffer = null;

    this.environment?.dispose();
    this.environment = null;

    this.sun?.dispose();
    this.sun = null;

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
    const frameMs = performance.now() - this.frameStartedAt;
    const drawCalls = takeFrameDrawCalls(
      engine,
      this.scene?.getActiveMeshes().length ?? 0,
    );
    this.adaptRenderScale(engine);

    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    this.onStats({
      fps: engine.getFps(),
      frameMs,
      budgetMs: FRAME_BUDGET_MS,
      width,
      height,
      drawCalls,
      renderScale: this.renderScale,
    });
  }

  /**
   * Trades resolution for frame time when the preview cannot hold its budget.
   *
   * The decision uses the engine frame interval (what the user sees), not the
   * CPU submit time `frameMs` reports. Scaling the canvas resizes every
   * screen-space target with it, so a slower GPU loses pixels instead of
   * dropping effect passes.
   */
  private adaptRenderScale(engine: Engine): void {
    if (this.scaleSamplesToSkip > 0) {
      this.scaleSamplesToSkip -= 1;
      return;
    }

    const sample = Math.min(engine.getDeltaTime(), MAX_FRAME_SAMPLE_MS);
    this.averageFrameMs = blendFrameTime(this.averageFrameMs, sample);

    this.framesUntilScaleUpdate -= 1;
    if (this.framesUntilScaleUpdate > 0) return;
    this.framesUntilScaleUpdate = RENDER_SCALE_SAMPLE_FRAMES;

    const next = nextRenderScale(
      this.renderScale,
      this.averageFrameMs,
      DEFAULT_RENDER_SCALE_POLICY,
    );
    if (next === this.renderScale) return;

    // Defer the resize to the next frame's before-render stage. Applying it
    // here (after the final post-process draw) would clear the canvas before
    // the browser composites the frame.
    this.pendingRenderScale = next;
  }

  private applyPendingRenderScale(): void {
    const next = this.pendingRenderScale;
    if (next === null) return;

    this.pendingRenderScale = null;
    this.renderScale = next;

    const engine = this.scene?.getEngine();
    if (!engine) return;

    engine.setHardwareScalingLevel(hardwareScalingLevel(next));
    this.pipeline?.resize();
    // The resize itself costs a frame; do not feed it back into the policy.
    this.scaleSamplesToSkip = Math.max(this.scaleSamplesToSkip, 2);
  }

  /** Ignore the frame-time sample produced by an expected compile/rebuild stall. */
  private holdRenderScale(): void {
    this.scaleSamplesToSkip = RENDER_SCALE_SAMPLE_FRAMES;
    this.averageFrameMs = Math.min(
      this.averageFrameMs,
      DEFAULT_RENDER_SCALE_POLICY.targetFrameMs,
    );
  }
}

/**
 * The engine's per-frame draw counter, and the roll-over Babylon's scene
 * instrumentation performs once per frame.
 *
 * `PerfCounter.current` only resets when `fetchNewFrame()` runs, and nothing in
 * this app enables `SceneInstrumentation`, so reading it without rolling it
 * over reports every draw call since the engine was created. The overlay then
 * climbs for as long as the preview runs.
 */
interface DrawCallCounter {
  readonly current?: number;
  fetchNewFrame?: () => void;
}

/** Draw calls submitted since the previous frame. */
export function takeFrameDrawCalls(engine: Engine, fallback: number): number {
  const counters = (engine as unknown as { _drawCalls?: DrawCallCounter })
    ._drawCalls;
  const current = counters?.current;
  counters?.fetchNewFrame?.();

  return typeof current === 'number' ? current : fallback;
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
