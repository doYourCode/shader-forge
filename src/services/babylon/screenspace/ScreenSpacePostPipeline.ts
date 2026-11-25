import {
  Constants,
  Matrix,
  ThinTexture,
  Vector3,
  type AbstractEngine,
  type BaseTexture,
  type Camera,
  type Effect,
  type InternalTexture,
  type Observer,
  type PostProcess,
  type Scene,
} from '@babylonjs/core';
import displayFragment from '@/assets/internal-shaders/post.screenspace.display.frag.glsl?raw';
import {
  SCREEN_SPACE_DISPLAY_SAMPLERS,
  SCREEN_SPACE_DISPLAY_UNIFORM_NAMES,
  SCREEN_SPACE_DISPLAY_UNIFORMS,
  SCREEN_SPACE_SAMPLER_NAMES,
  SCREEN_SPACE_SAMPLERS,
  SCREEN_SPACE_UNIFORMS,
} from '@/core/constants/screenSpaceAbi';
import {
  debugModeValue,
  type GbufferDebugMode,
} from '@/core/constants/screenSpaceDebug';
import {
  requiredScreenSpaceAttachments,
  type ScreenSpaceAttachment,
} from '@/core/screenspace/gbufferAttachments';
import type { CompileResult } from '@/core/models/compileResult';
import type { PostEffectStack, TonemapMode } from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import type { ShaderLogRecorder } from '@/services/gpu/ShaderLogRecorder';
import {
  UniformBinder,
  type TextureResolver,
  type UniformBinding,
} from '@/services/userdata/UniformBinding';
import { EffectBindingTarget } from '../preview/post/EffectBindingTarget';
import { PostEffectCompiler } from '../preview/post/PostEffectCompiler';
import { activeSamplers } from '../preview/post/activeSamplers';
import type { ScreenSpaceGbuffer } from './ScreenSpaceGbuffer';

const DISPLAY_PASS = 'sf-screen-space-display';
const EFFECT_PASS_PREFIX = 'sf-screen-space-effect';

const TONEMAP_VALUES: Record<TonemapMode, number> = {
  none: 0,
  reinhard: 1,
  aces: 2,
};

export interface ScreenSpacePostPipelineDeps {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly engine: AbstractEngine;
  readonly textures: TextureResolver<BaseTexture>;
  readonly getUserBindings: () => readonly UniformBinding[];
  readonly recorder: ShaderLogRecorder | null;
  readonly gbuffer: ScreenSpaceGbuffer;
  /** Injectable for deterministic tests; production uses the real compiler. */
  readonly compiler?: PostEffectCompiler;
}

/**
 * Owns the screen-space effect chain: the user passes and the display pass.
 *
 * There is no linearize pass: the scene is rendered with image processing
 * disabled, so the first post-process input is already linear HDR. The display
 * pass applies exposure/tonemap and composites the separate transparent
 * overlay. Compilation is atomic; a failed effect leaves the previous chain
 * rendering.
 */
export class ScreenSpacePostPipeline {
  private readonly deps: ScreenSpacePostPipelineDeps;
  private readonly compiler: PostEffectCompiler;
  private readonly binder: UniformBinder<BaseTexture>;
  private readonly targets = new Map<PostProcess, EffectBindingTarget>();
  private readonly cameraPosition = Vector3.Zero();
  private readonly inverseProjection = Matrix.Identity();
  private readonly inverseView = Matrix.Identity();
  private readonly viewProjection = Matrix.Identity();
  private readonly inverseViewProjection = Matrix.Identity();
  private readonly previousViewProjection = Matrix.Identity();
  private readonly frameObserver: Observer<Scene>;
  private chain: PostProcess[] = [];
  private display: PostProcess | null = null;
  private tonemap: TonemapMode = 'none';
  private debugMode: GbufferDebugMode = 'off';
  private usesObjectId = false;
  private effectSamplers: ReadonlySet<string> = new Set();
  private requiredAttachments: ReadonlySet<ScreenSpaceAttachment> = new Set();
  private sceneColorWrapper: ThinTexture | null = null;
  private sceneColorInternal: InternalTexture | null = null;
  private frameIndex = 0;
  private deltaSeconds = 0;
  private generation = 0;
  private disposed = false;

  constructor(deps: ScreenSpacePostPipelineDeps) {
    this.deps = deps;
    this.compiler =
      deps.compiler ??
      new PostEffectCompiler(
        deps.engine,
        deps.recorder,
        renderTextureType(deps.engine),
      );
    this.binder = new UniformBinder(deps.textures);

    this.frameObserver = deps.scene.onBeforeRenderObservable.add(() => {
      this.updateFrameUniforms();
    });
  }

  get passes(): readonly PostProcess[] {
    return this.chain;
  }

  get displayPass(): PostProcess | null {
    return this.display;
  }

  /**
   * Compiles the enabled stack and installs it atomically. The previous chain
   * keeps rendering if any pass fails.
   */
  async compile(stack: PostEffectStack): Promise<CompileResult> {
    if (this.disposed) {
      return { status: 'unavailable', reason: 'scene-disposed' };
    }

    const generation = ++this.generation;
    const candidates: PostProcess[] = [];
    const effectPasses: PostProcess[] = [];
    const errors: ShaderError[] = [];

    for (const effect of stack.effects) {
      const pass = await this.compiler.compile({
        name: `${EFFECT_PASS_PREFIX}-${effect.id}-${generation}`,
        fragment: effect.fragment,
        uniforms: [...SCREEN_SPACE_UNIFORMS, ...effect.extraUniforms],
        samplers: [...SCREEN_SPACE_SAMPLERS, ...effect.extraSamplers],
        source: effect,
      });

      if (!pass.ok) {
        errors.push(...pass.errors);
        break;
      }

      candidates.push(pass.postProcess);
      effectPasses.push(pass.postProcess);
    }

    if (errors.length > 0) {
      disposeAll(candidates);
      return { status: 'failed', errors };
    }

    const display = await this.compiler.compile({
      name: `${DISPLAY_PASS}-${generation}`,
      fragment: displayFragment,
      uniforms: [...SCREEN_SPACE_DISPLAY_UNIFORMS],
      samplers: [...SCREEN_SPACE_DISPLAY_SAMPLERS],
      source: null,
    });

    if (!display.ok) {
      disposeAll(candidates);
      return { status: 'failed', errors: display.errors };
    }
    candidates.push(display.postProcess);

    if (this.disposed || generation !== this.generation) {
      disposeAll(candidates);
      return { status: 'unavailable', reason: 'compile-superseded' };
    }

    // Plan from the linked programs, not from the sources: the ABI shaders
    // declare every sampler they may read, so a textual match would request a
    // full G-buffer (and an object-id pass) for a passthrough.
    const samplers = activeSamplers(effectPasses);
    this.effectSamplers = samplers;
    this.usesObjectId = samplers.has(SCREEN_SPACE_SAMPLER_NAMES.objectId);
    this.requiredAttachments = requiredScreenSpaceAttachments(
      samplers,
      this.debugMode,
    );

    this.install(candidates, stack.tonemap);
    return { status: 'ok' };
  }

  setTonemap(mode: TonemapMode): void {
    this.tonemap = mode;
  }

  setDebugMode(mode: GbufferDebugMode): void {
    this.debugMode = mode;
    this.deps.gbuffer.setObjectIdEnabled(
      this.usesObjectId || mode === 'objectId',
    );

    // A debug view reads attachments the effect stack may not need, so the
    // PrePass layout follows the selected mode.
    this.requiredAttachments = requiredScreenSpaceAttachments(
      this.effectSamplers,
      mode,
    );
    this.deps.gbuffer.setRequiredAttachments(this.requiredAttachments);
    this.deps.gbuffer.refreshPrePass(this.chain);
  }

  resize(): void {
    this.deps.gbuffer.resize(
      renderWidth(this.deps.engine),
      renderHeight(this.deps.engine),
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.deps.scene.onBeforeRenderObservable.remove(this.frameObserver);
    this.detachChain();
    this.binder.attach(null);
    this.releaseSceneColorWrapper();
  }

  private install(chain: readonly PostProcess[], tonemap: TonemapMode): void {
    this.detachChain();

    for (const postProcess of chain) {
      postProcess.onApplyObservable.add(() => this.applyPass(postProcess));
      this.deps.camera.attachPostProcess(postProcess);
    }

    this.chain = [...chain];
    this.display = this.chain[this.chain.length - 1] ?? null;
    this.tonemap = tonemap;
    this.deps.gbuffer.setRequiredAttachments(this.requiredAttachments);
    this.deps.gbuffer.refreshPrePass(this.chain);
    this.deps.gbuffer.setObjectIdEnabled(
      this.usesObjectId || this.debugMode === 'objectId',
    );
  }

  private detachChain(): void {
    for (const postProcess of this.chain) {
      this.targets.delete(postProcess);
      this.deps.camera.detachPostProcess(postProcess);
      postProcess.dispose();
    }

    this.chain = [];
    this.display = null;
  }

  private applyPass(postProcess: PostProcess): void {
    if (this.disposed) return;

    const effect = postProcess.getEffect();
    if (!effect) return;

    const width = Math.max(renderWidth(this.deps.engine), 1);
    const height = Math.max(renderHeight(this.deps.engine), 1);
    const camera = this.deps.camera;
    const isDisplay = postProcess === this.display;

    effect.setFloat('time', performance.now() * 0.001);
    effect.setFloat2('resolution', width, height);
    effect.setFloat2('texelSize', 1 / width, 1 / height);
    effect.setFloat('cameraNear', camera.minZ);
    effect.setFloat('cameraFar', camera.maxZ);
    effect.setVector3('cameraPosition', this.cameraPosition);
    effect.setMatrix('projection', camera.getProjectionMatrix());
    effect.setMatrix('inverseProjection', this.inverseProjection);
    effect.setMatrix('view', camera.getViewMatrix());
    effect.setMatrix('inverseView', this.inverseView);
    effect.setMatrix('viewProjection', this.viewProjection);
    effect.setMatrix('inverseViewProjection', this.inverseViewProjection);
    effect.setMatrix('previousViewProjection', this.previousViewProjection);
    effect.setFloat('frameIndex', this.frameIndex);
    effect.setFloat('deltaTime', this.deltaSeconds);

    this.deps.gbuffer.bind(effect);
    this.bindSceneColor(effect);

    if (isDisplay) {
      this.deps.gbuffer.bindTransparent(effect);
      effect.setFloat(
        SCREEN_SPACE_DISPLAY_UNIFORM_NAMES.toneMappingMode,
        TONEMAP_VALUES[this.tonemap],
      );
      effect.setFloat(
        SCREEN_SPACE_DISPLAY_UNIFORM_NAMES.debugMode,
        debugModeValue(this.debugMode),
      );
    }

    this.binder.attach(this.targetFor(postProcess));
    this.binder.applyAll(this.deps.getUserBindings());
  }

  private targetFor(postProcess: PostProcess): EffectBindingTarget {
    let target = this.targets.get(postProcess);
    if (!target) {
      target = new EffectBindingTarget(postProcess.getEffect());
      this.targets.set(postProcess, target);
    }
    return target;
  }

  private bindSceneColor(effect: Effect): void {
    const internal = this.chain[0]?.inputTexture?.texture ?? null;
    if (!internal) return;

    if (this.sceneColorInternal !== internal) {
      // Do not release the previous wrapper: it wraps a post-process input
      // texture owned by Babylon, not by this pipeline.
      this.sceneColorWrapper = new ThinTexture(internal);
      this.sceneColorInternal = internal;
    }

    if (this.sceneColorWrapper) {
      effect.setTexture(
        SCREEN_SPACE_SAMPLER_NAMES.sceneColor,
        this.sceneColorWrapper,
      );
    }
  }

  private releaseSceneColorWrapper(): void {
    // The wrapper is a view over Babylon's input texture; dropping the
    // reference is the only safe disposal.
    this.sceneColorWrapper = null;
    this.sceneColorInternal = null;
  }

  private updateFrameUniforms(): void {
    const camera = this.deps.camera;
    const view = camera.getViewMatrix();
    const projection = camera.getProjectionMatrix();
    const nextViewProjection = view.multiply(projection);

    if (this.frameIndex === 0) {
      this.previousViewProjection.copyFrom(nextViewProjection);
    } else {
      this.previousViewProjection.copyFrom(this.viewProjection);
    }

    this.viewProjection.copyFrom(nextViewProjection);
    this.inverseViewProjection.copyFrom(nextViewProjection);
    this.inverseViewProjection.invert();

    this.inverseProjection.copyFrom(projection);
    this.inverseProjection.invert();

    this.inverseView.copyFrom(view);
    this.inverseView.invert();

    this.cameraPosition.copyFrom(camera.globalPosition);
    this.deltaSeconds = this.deps.engine.getDeltaTime() / 1000;
    this.frameIndex += 1;
  }
}

function disposeAll(postProcesses: readonly PostProcess[]): void {
  for (const postProcess of postProcesses) postProcess.dispose();
}

function renderWidth(engine: AbstractEngine): number {
  return engine.getRenderWidth();
}

function renderHeight(engine: AbstractEngine): number {
  return engine.getRenderHeight();
}

/** HDR passes need a float colour target when the engine can render one. */
function renderTextureType(engine: AbstractEngine): number {
  const caps = engine.getCaps();
  if (caps.textureHalfFloatRender) return Constants.TEXTURETYPE_HALF_FLOAT;
  if (caps.textureFloatRender) return Constants.TEXTURETYPE_FLOAT;
  return Constants.TEXTURETYPE_UNSIGNED_BYTE;
}
