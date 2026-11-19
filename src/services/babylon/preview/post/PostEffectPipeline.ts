import {
  Constants,
  Matrix,
  Vector3,
  type AbstractEngine,
  type Camera,
  type Mesh,
  type Observer,
  type PostProcess,
  type Scene,
} from '@babylonjs/core';
import {
  POST_EFFECT_SAMPLER_NAMES,
  POST_EFFECT_TONEMAP_UNIFORM,
  POST_EFFECT_UNIFORM_NAMES,
  POST_EFFECT_UNIFORMS,
} from '@/core/constants/postEffectAbi';
import type { CompileResult } from '@/core/models/compileResult';
import type { PostEffectStack, TonemapMode } from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import type { ShaderLogRecorder } from '@/services/webgl/ShaderLogRecorder';
import {
  UniformBinder,
  type TextureResolver,
  type UniformBinding,
} from '@/services/userdata/UniformBinder';
import { internalShaders } from '../../internalShaders';
import { EffectBindingTarget } from './EffectBindingTarget';
import { PostEffectCompiler } from './PostEffectCompiler';
import { ViewSpaceGbuffer } from './ViewSpaceGbuffer';

const LINEARIZE_PASS = 'sf-post-linearize';
const DISPLAY_PASS = 'sf-post-display';
const EFFECT_PASS_PREFIX = 'sf-post-effect';

const TONEMAP_VALUES: Record<TonemapMode, number> = {
  none: 0,
  reinhard: 1,
  aces: 2,
};

export interface PostEffectPipelineDeps {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly engine: AbstractEngine;
  readonly textures: TextureResolver;
  readonly getUserBindings: () => readonly UniformBinding[];
  readonly recorder: ShaderLogRecorder | null;
}

/**
 * Owns the view-space effect chain: the normal/depth prepass, the linear
 * conversion, the user's `PostProcess`es and the display transform.
 *
 * The chain is rebuilt only from fully compiled candidates, so a failed
 * compile leaves the last working image on screen (the project rule for
 * surface shaders applies here too). Compilation is serialized by the caller
 * because all passes share the WebGL log recorder.
 */
export class PostEffectPipeline {
  private readonly deps: PostEffectPipelineDeps;
  private readonly gbuffer: ViewSpaceGbuffer;
  private readonly binder: UniformBinder;
  private readonly targets = new Map<PostProcess, EffectBindingTarget>();
  private readonly cameraPosition = Vector3.Zero();
  private readonly inverseProjection = Matrix.Identity();
  private readonly inverseView = Matrix.Identity();
  private chain: PostProcess[] = [];
  private tonemap: TonemapMode = 'none';
  private generation = 0;
  private disposed = false;
  private readonly frameObserver: Observer<Scene>;

  constructor(deps: PostEffectPipelineDeps, mesh: Mesh) {
    this.deps = deps;
    this.binder = new UniformBinder(deps.textures);
    this.gbuffer = new ViewSpaceGbuffer(
      deps.scene,
      deps.camera,
      mesh,
      renderWidth(deps.engine),
      renderHeight(deps.engine),
    );

    // Refresh the camera matrices once per frame, not once per pass.
    this.frameObserver = deps.scene.onBeforeRenderObservable.add(() => {
      this.updateFrameUniforms();
    });
  }

  get gbufferTexture(): ViewSpaceGbuffer['texture'] {
    return this.gbuffer.texture;
  }

  /**
   * Compiles the whole enabled stack and installs it atomically. The previous
   * chain keeps rendering if any pass fails.
   */
  async compile(stack: PostEffectStack): Promise<CompileResult> {
    if (this.disposed) {
      return { status: 'unavailable', reason: 'scene-disposed' };
    }

    const generation = ++this.generation;
    const compiler = new PostEffectCompiler(
      this.deps.engine,
      this.deps.recorder,
      renderTextureType(this.deps.engine),
    );
    const candidates: PostProcess[] = [];
    const errors: ShaderError[] = [];

    const linearize = await compiler.compile({
      name: `${LINEARIZE_PASS}-${generation}`,
      fragment: internalShaders.post.linearize,
      uniforms: [],
      samplers: [],
      source: null,
    });

    if (!linearize.ok) {
      return { status: 'failed', errors: linearize.errors };
    }
    candidates.push(linearize.postProcess);

    for (const effect of stack.effects) {
      const pass = await compiler.compile({
        name: `${EFFECT_PASS_PREFIX}-${effect.id}-${generation}`,
        fragment: effect.fragment,
        uniforms: [...POST_EFFECT_UNIFORMS, ...effect.extraUniforms],
        samplers: [
          POST_EFFECT_SAMPLER_NAMES.gbuffer,
          POST_EFFECT_SAMPLER_NAMES.depth,
          ...effect.extraSamplers,
        ],
        source: effect,
      });

      if (!pass.ok) {
        errors.push(...pass.errors);
        break;
      }

      candidates.push(pass.postProcess);
    }

    if (errors.length > 0) {
      disposeAll(candidates);
      return { status: 'failed', errors };
    }

    const display = await compiler.compile({
      name: `${DISPLAY_PASS}-${generation}`,
      fragment: internalShaders.post.display,
      uniforms: [POST_EFFECT_TONEMAP_UNIFORM],
      samplers: [],
      source: null,
    });

    if (!display.ok) {
      disposeAll(candidates);
      return { status: 'failed', errors: display.errors };
    }
    candidates.push(display.postProcess);

    // A newer compile may have started while this one awaited the driver.
    if (this.disposed || generation !== this.generation) {
      disposeAll(candidates);
      return { status: 'unavailable', reason: 'compile-superseded' };
    }

    this.install(candidates, stack.tonemap);
    return { status: 'ok' };
  }

  /** Output transform only; the display pass reads it every frame. */
  setTonemap(mode: TonemapMode): void {
    this.tonemap = mode;
  }

  setMesh(mesh: Mesh): void {
    this.gbuffer.setMesh(mesh);
  }

  resize(): void {
    this.gbuffer.resize(
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
    this.gbuffer.dispose();
  }

  private install(chain: readonly PostProcess[], tonemap: TonemapMode): void {
    this.detachChain();

    for (const postProcess of chain) {
      postProcess.onApplyObservable.add(() => this.applyPass(postProcess));
      this.deps.camera.attachPostProcess(postProcess);
    }

    this.chain = [...chain];
    this.tonemap = tonemap;
  }

  private detachChain(): void {
    for (const postProcess of this.chain) {
      this.targets.delete(postProcess);
      this.deps.camera.detachPostProcess(postProcess);
      postProcess.dispose();
    }

    this.chain = [];
  }

  /**
   * Binds everything a pass reads: the camera/frame uniforms, the geometry
   * prepass and the user-data values of the current document.
   */
  private applyPass(postProcess: PostProcess): void {
    if (this.disposed) return;

    const effect = postProcess.getEffect();
    const width = renderWidth(this.deps.engine);
    const height = renderHeight(this.deps.engine);
    const camera = this.deps.camera;

    effect.setFloat(POST_EFFECT_UNIFORM_NAMES.time, performance.now() * 0.001);
    effect.setFloat2(POST_EFFECT_UNIFORM_NAMES.resolution, width, height);
    effect.setFloat2(
      POST_EFFECT_UNIFORM_NAMES.texelSize,
      1 / Math.max(width, 1),
      1 / Math.max(height, 1),
    );
    effect.setFloat(POST_EFFECT_UNIFORM_NAMES.cameraNear, camera.minZ);
    effect.setFloat(POST_EFFECT_UNIFORM_NAMES.cameraFar, camera.maxZ);
    effect.setVector3(
      POST_EFFECT_UNIFORM_NAMES.cameraPosition,
      this.cameraPosition,
    );
    effect.setMatrix(
      POST_EFFECT_UNIFORM_NAMES.projection,
      camera.getProjectionMatrix(),
    );
    effect.setMatrix(
      POST_EFFECT_UNIFORM_NAMES.inverseProjection,
      this.inverseProjection,
    );
    effect.setMatrix(POST_EFFECT_UNIFORM_NAMES.view, camera.getViewMatrix());
    effect.setMatrix(POST_EFFECT_UNIFORM_NAMES.inverseView, this.inverseView);
    effect.setFloat(POST_EFFECT_TONEMAP_UNIFORM, TONEMAP_VALUES[this.tonemap]);
    this.gbuffer.bind(effect);

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

  private updateFrameUniforms(): void {
    const camera = this.deps.camera;
    this.cameraPosition.copyFrom(camera.globalPosition);

    this.inverseProjection.copyFrom(camera.getProjectionMatrix());
    this.inverseProjection.invert();

    this.inverseView.copyFrom(camera.getViewMatrix());
    this.inverseView.invert();
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

/** Rendering to a half-float target needs the float colour-buffer extension. */
function renderTextureType(engine: AbstractEngine): number {
  return engine.getCaps().colorBufferFloat
    ? Constants.TEXTURETYPE_HALF_FLOAT
    : Constants.TEXTURETYPE_UNSIGNED_BYTE;
}
