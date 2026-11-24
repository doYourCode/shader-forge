import type { CompileResult } from '@/core/models/compileResult';
import type { PostEffectStack, TonemapMode } from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import type { MaterialBlueprint } from '@/core/models/shaderSource';
import { previewTextureCatalog } from '@/core/constants/previewTextures';
import { parseShaderCompileErrors } from '@/core/utils/shaderErrors';
import {
  internalError,
  webGl2RequiredError,
} from '@/services/babylon/preview/errors/shaderErrorFactory';
import { CompositeUniformBindingTarget } from '@/services/userdata/CompositeUniformBindingTarget';
import { UniformBinder } from '@/services/userdata/UniformBinding';
import type { UserDataController } from '@/services/userdata/UserDataController';
import { ShaderLogRecorder } from '@/services/webgl/ShaderLogRecorder';
import { SandboxPostPipeline } from './SandboxPostPipeline';
import { SandboxTextureRegistry } from './SandboxTextureRegistry';
import { SandboxUniformBindingTarget } from './SandboxUniformBindingTarget';
import { TextureUnitAllocator } from './TextureUnitAllocator';

const MAX_DEVICE_PIXEL_RATIO = 2;
/** Post built-ins use 0–2; user samplers are shared from 3 upward. */
const USER_SAMPLER_FIRST_UNIT = 3;

/**
 * Minimal WebGL 2 renderer for the 2D sandbox.
 *
 * It owns one canvas, one fullscreen triangle and one fragment program. It is
 * intentionally independent of Babylon: the sandbox has no mesh, scene,
 * environment or camera, so booting the 3D preview stack would be pure cost.
 * A failed compile keeps the previous program alive, matching the 3D preview's
 * preserve-the-last-working-image rule.
 */
export class SandboxPreview {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext | null;
  private readonly recorder: ShaderLogRecorder | null;
  private readonly contextError: ShaderError | null = null;
  private readonly vao: WebGLVertexArrayObject | null = null;

  private readonly postPipeline: SandboxPostPipeline | null = null;
  private readonly textureUnits = new TextureUnitAllocator(
    USER_SAMPLER_FIRST_UNIT,
  );
  private program: WebGLProgram | null = null;
  private resolutionLocation: WebGLUniformLocation | null = null;
  private timeLocation: WebGLUniformLocation | null = null;
  private baseBindingTarget: SandboxUniformBindingTarget | null = null;
  private userData: UserDataController<WebGLTexture> | null = null;
  private textures: SandboxTextureRegistry | null = null;
  private animationFrame: number | null = null;
  private paused = false;
  private elapsedSeconds = 0;
  private lastTimestamp = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      this.gl = null;
      this.recorder = null;
      this.contextError = webGl2RequiredError();
      return;
    }

    this.gl = gl;
    this.recorder = new ShaderLogRecorder(gl);
    this.postPipeline = new SandboxPostPipeline(
      gl,
      this.recorder,
      this.textureUnits,
    );
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.clearColor(0.02, 0.03, 0.05, 1);

    this.resize();
    this.start();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleResize);
    }
  }

  /**
   * Compiles a new fullscreen program. Shader compilation is synchronous, so
   * callers can apply the result immediately. The blueprint carries the
   * assembled stages plus the untouched editor fragment and user-data
   * assembly record needed to attribute diagnostics.
   */
  compile(blueprint: MaterialBlueprint): CompileResult {
    const gl = this.gl;
    const recorder = this.recorder;

    if (!gl || !recorder) {
      return {
        status: 'failed',
        errors: [this.contextError ?? webGl2RequiredError()],
      };
    }

    if (gl.isContextLost()) {
      return {
        status: 'failed',
        errors: [
          internalError(
            'The WebGL 2 context was lost while compiling the sandbox shader.',
          ),
        ],
      };
    }

    recorder.begin();

    const vertexShader = this.compileStage(gl.VERTEX_SHADER, blueprint.vertex);
    const fragmentShader = this.compileStage(
      gl.FRAGMENT_SHADER,
      blueprint.fragment,
    );

    if (!vertexShader || !fragmentShader) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      return this.failedCompile(blueprint);
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return {
        status: 'failed',
        errors: [
          internalError('The sandbox could not allocate a shader program.'),
        ],
      };
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // Reading the program log is what feeds ShaderLogRecorder; the returned log
    // is intentionally ignored in favour of the parsed records.
    gl.getProgramInfoLog(program);

    const linked = Boolean(gl.getProgramParameter(program, gl.LINK_STATUS));
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!linked) {
      gl.deleteProgram(program);
      return this.failedCompile(blueprint);
    }

    if (this.program) gl.deleteProgram(this.program);

    this.program = program;
    this.resolutionLocation = gl.getUniformLocation(program, 'uResolution');
    this.timeLocation = gl.getUniformLocation(program, 'uTime');
    this.baseBindingTarget = new SandboxUniformBindingTarget(
      gl,
      program,
      this.textureUnits,
    );
    gl.useProgram(program);
    this.syncUserDataTargets();

    // The render loop is intentionally stopped while paused, so draw one frame
    // here. Otherwise a compile made while paused would stay invisible until
    // the user pressed Resume.
    this.render();

    return { status: 'ok' };
  }

  /** Compiles the post-effect chain atomically, preserving the last good one. */
  compilePostEffects(stack: PostEffectStack): CompileResult {
    const gl = this.gl;
    const pipeline = this.postPipeline;

    if (!gl || !pipeline) {
      return {
        status: 'failed',
        errors: [this.contextError ?? webGl2RequiredError()],
      };
    }

    this.resize();
    const result = pipeline.compile(stack);

    if (result.status === 'ok') {
      // Both program families now match the document, so retired textures can
      // be released safely.
      this.syncUserDataTargets(true);
      this.renderOnce();
    }

    return result;
  }

  /** The display pass reads the transform every frame; no recompile needed. */
  setTonemap(mode: TonemapMode): void {
    this.postPipeline?.setTonemap(mode);
    this.renderOnce();
  }

  /**
   * Attaches the user-data document to this preview. The registry and binder
   * are texture-handle-scoped to WebGL, so they must live beside the context,
   * not in the composable.
   */
  attachUserData(controller: UserDataController<WebGLTexture> | null): void {
    if (this.userData === controller) return;

    this.detachUserData();
    this.userData = controller;

    const gl = this.gl;
    if (!controller || !gl) return;

    const textures = new SandboxTextureRegistry(
      gl,
      previewTextureCatalog.find,
      {
        // A texture may finish loading while the preview is paused. Draw once so
        // it becomes visible without the user pressing Resume.
        onTextureReady: () => this.renderOnce(),
      },
    );
    const binder = new UniformBinder<WebGLTexture>(textures);
    this.textures = textures;

    controller.attachGpu({ textures, binder });
    this.syncUserDataTargets();
  }

  /** Draws a single frame; used for async work completed while paused. */
  renderOnce(): void {
    if (this.disposed || !this.gl || !this.program) return;
    this.render();
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;

    this.paused = paused;
    if (!paused) this.start();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }

    this.detachUserData();
    this.postPipeline?.dispose();

    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    const gl = this.gl;
    if (!gl) return;

    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }

    if (this.vao) {
      gl.deleteVertexArray(this.vao);
    }

    this.recorder?.dispose();
  }

  private compileStage(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) return null;

    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // Always read the log so the recorder captures it; it only records
    // non-empty logs, so a successful stage adds no noise.
    gl.getShaderInfoLog(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private failedCompile(blueprint: MaterialBlueprint): CompileResult {
    const errors = parseShaderCompileErrors(
      this.recorder?.drain() ?? [],
      {
        vertex: blueprint.vertex,
        fragment: blueprint.fragment,
        editorSource: blueprint.editorSource,
        userData: blueprint.userData,
      },
      'The sandbox shader program failed to link.',
    );

    return { status: 'failed', errors };
  }

  private detachUserData(): void {
    this.userData?.attachGpu(null);
    this.textures?.dispose();
    this.textures = null;
    this.userData = null;
  }

  /**
   * Re-attaches the binder to every live program: the base pass and each post
   * effect pass. A target whose program does not declare a name ignores it, so
   * the whole document can safely be applied to all of them.
   */
  private syncUserDataTargets(flushReleases = false): void {
    if (!this.userData) return;

    const targets = [
      ...(this.baseBindingTarget ? [this.baseBindingTarget] : []),
      ...(this.postPipeline?.bindingTargets() ?? []),
    ];
    const target =
      targets.length > 0 ? new CompositeUniformBindingTarget(targets) : null;

    if (flushReleases) {
      this.userData.onMaterialApplied(target);
    } else {
      this.userData.applyBindings(target);
    }
  }

  /** A paused preview still needs a fresh frame when its canvas box changes. */
  private readonly handleResize = (): void => {
    if (this.paused) this.render();
  };

  private start(): void {
    if (
      this.disposed ||
      this.paused ||
      !this.gl ||
      this.animationFrame !== null ||
      typeof requestAnimationFrame === 'undefined'
    ) {
      return;
    }

    this.lastTimestamp = performance.now();
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (timestamp: number): void => {
    this.animationFrame = null;

    const delta = Math.min(Math.max(timestamp - this.lastTimestamp, 0), 100);
    this.lastTimestamp = timestamp;

    if (!this.paused) {
      this.elapsedSeconds += delta / 1000;
    }

    this.render();

    if (!this.paused) {
      this.animationFrame = requestAnimationFrame(this.tick);
    }
  };

  private render(): void {
    const gl = this.gl;
    if (!gl) return;

    this.resize();

    const post = this.postPipeline;
    if (post?.hasChain() && post.beginBasePass()) {
      this.drawBaseProgram();
      post.renderChain(this.elapsedSeconds);
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.drawBaseProgram();
  }

  private drawBaseProgram(): void {
    const gl = this.gl;
    const program = this.program;
    if (!gl || !program) return;

    gl.useProgram(program);

    if (this.resolutionLocation) {
      gl.uniform2f(
        this.resolutionLocation,
        this.canvas.width,
        this.canvas.height,
      );
    }

    if (this.timeLocation) {
      gl.uniform1f(this.timeLocation, this.elapsedSeconds);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private resize(): void {
    const ratio =
      typeof window === 'undefined'
        ? 1
        : Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.postPipeline?.resize(width, height);
  }
}
