import type { CompileResult } from '@/core/models/compileResult';
import type {
  PostEffectSource,
  PostEffectStack,
  TonemapMode,
} from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import {
  POST_EFFECT_SAMPLER_NAMES,
  POST_EFFECT_TONEMAP_UNIFORM,
  POST_EFFECT_UNIFORM_NAMES,
} from '@/core/constants/postEffectAbi';
import { postEffectShaders } from '@/core/constants/postEffectShaders';
import {
  parseShaderCompileErrors,
  type ShaderCompileRecord,
} from '@/core/utils/shaderErrors';
import type { ShaderLogRecorder } from '@/services/webgl/ShaderLogRecorder';
import { SandboxUniformBindingTarget } from './SandboxUniformBindingTarget';
import { TextureUnitAllocator } from './TextureUnitAllocator';

const TONEMAP_VALUES: Record<TonemapMode, number> = {
  none: 0,
  reinhard: 1,
  aces: 2,
};

const GBUFFER_SAMPLER_UNIT = 1;
const DEPTH_SAMPLER_UNIT = 2;
const USER_SAMPLER_FIRST_UNIT = 3;

const IDENTITY_MATRIX = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

interface RenderTarget {
  readonly framebuffer: WebGLFramebuffer;
  readonly texture: WebGLTexture;
  readonly width: number;
  readonly height: number;
}

interface Pass {
  readonly program: WebGLProgram;
  readonly locations: Map<string, WebGLUniformLocation | null>;
  readonly userTarget: SandboxUniformBindingTarget | null;
}

interface PassCompile {
  readonly pass: Pass | null;
  readonly errors: readonly ShaderError[];
}

interface TargetFormat {
  readonly internalFormat: number;
  readonly type: number;
}

/**
 * WebGL 2 post-effect chain for the 2D sandbox.
 *
 * The base fragment is rendered into target A, linearized into target B, then
 * every enabled effect ping-pongs between the two targets. The display pass
 * applies the output transform and writes to the canvas.
 *
 * The 3D pipeline's view-space inputs do not exist in a 2D sandbox. A neutral
 * normal/far-depth texture and identity camera matrices keep the shared ABI
 * compiling; geometry-dependent effects are intentionally no-ops here.
 */
export class SandboxPostPipeline {
  private readonly gl: WebGL2RenderingContext;
  private readonly recorder: ShaderLogRecorder | null;
  private readonly textureUnits: TextureUnitAllocator;
  private readonly halfFloatSupported: boolean;

  private linearize: Pass | null = null;
  private effects: Pass[] = [];
  private display: Pass | null = null;
  private targetA: RenderTarget | null = null;
  private targetB: RenderTarget | null = null;
  private gbufferTexture: WebGLTexture | null = null;
  private depthTexture: WebGLTexture | null = null;
  private tonemap: TonemapMode = 'none';
  private width = 1;
  private height = 1;
  private disposed = false;

  constructor(
    gl: WebGL2RenderingContext,
    recorder: ShaderLogRecorder | null,
    textureUnits: TextureUnitAllocator = new TextureUnitAllocator(
      USER_SAMPLER_FIRST_UNIT,
    ),
  ) {
    this.gl = gl;
    this.recorder = recorder;
    this.textureUnits = textureUnits;
    this.halfFloatSupported = Boolean(
      gl.getExtension('EXT_color_buffer_float') ??
      gl.getExtension('EXT_color_buffer_half_float'),
    );
  }

  hasChain(): boolean {
    return this.linearize !== null && this.display !== null;
  }

  /** User-data targets for the current effect programs. */
  bindingTargets(): readonly SandboxUniformBindingTarget[] {
    return this.effects.flatMap((pass) =>
      pass.userTarget ? [pass.userTarget] : [],
    );
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  setTonemap(mode: TonemapMode): void {
    this.tonemap = mode;
  }

  /**
   * Compiles a complete candidate chain. On any failure the previous chain is
   * kept intact, matching the 3D pipeline's last-working-image rule.
   */
  compile(stack: PostEffectStack): CompileResult {
    if (this.disposed) {
      return { status: 'unavailable', reason: 'scene-disposed' };
    }

    if (!this.ensureTargets() || !this.ensureDummyTextures()) {
      return {
        status: 'failed',
        errors: [
          internalError('The sandbox post targets could not be allocated.'),
        ],
      };
    }

    const vertex = this.compileVertexShader();
    if (!vertex) {
      return {
        status: 'failed',
        errors: [
          internalError('The sandbox post vertex shader failed to compile.'),
        ],
      };
    }

    const candidates: Pass[] = [];
    const errors: ShaderError[] = [];

    const linearize = this.compilePass(
      vertex,
      postEffectShaders.linearize,
      null,
    );
    const linearizePass = linearize.pass;
    if (!linearizePass) errors.push(...linearize.errors);
    else candidates.push(linearizePass);

    const effectPasses: Pass[] = [];
    if (errors.length === 0) {
      for (const effect of stack.effects) {
        const result = this.compilePass(vertex, effect.fragment, effect);
        if (!result.pass) {
          errors.push(...result.errors);
          break;
        }

        effectPasses.push(result.pass);
        candidates.push(result.pass);
      }
    }

    let display: Pass | null = null;
    if (errors.length === 0) {
      const result = this.compilePass(vertex, postEffectShaders.display, null);
      if (!result.pass) errors.push(...result.errors);
      else {
        display = result.pass;
        candidates.push(result.pass);
      }
    }

    this.gl.deleteShader(vertex);

    if (errors.length > 0 || !display || !linearizePass) {
      disposePasses(this.gl, candidates);
      return {
        status: 'failed',
        errors:
          errors.length > 0
            ? errors
            : [internalError('The sandbox display pass is unavailable.')],
      };
    }

    this.install(linearizePass, effectPasses, display, stack.tonemap);
    return { status: 'ok' };
  }

  /**
   * Binds the base-pass framebuffer and clears it. Returns false when the
   * chain or its targets are unavailable, so the caller can render directly.
   */
  beginBasePass(): boolean {
    if (!this.hasChain() || !this.ensureTargets()) return false;

    const target = this.targetA;
    if (!target) return false;

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer);
    this.gl.viewport(0, 0, target.width, target.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    return true;
  }

  /** Runs linearize → effects → display, ending on the default framebuffer. */
  renderChain(timeSeconds: number): void {
    const linearize = this.linearize;
    const display = this.display;
    const targetA = this.targetA;
    const targetB = this.targetB;

    if (!linearize || !display || !targetA || !targetB) return;

    this.drawPass(linearize, targetB, () => {
      this.bindTexture(
        linearize,
        POST_EFFECT_SAMPLER_NAMES.scene,
        0,
        targetA.texture,
      );
    });

    let current = targetB;
    let next = targetA;

    for (const pass of this.effects) {
      this.drawPass(pass, next, () => {
        this.applyCommonUniforms(
          pass,
          current.width,
          current.height,
          timeSeconds,
        );
        this.bindTexture(
          pass,
          POST_EFFECT_SAMPLER_NAMES.scene,
          0,
          current.texture,
        );
        this.bindTexture(
          pass,
          POST_EFFECT_SAMPLER_NAMES.gbuffer,
          GBUFFER_SAMPLER_UNIT,
          this.gbufferTexture,
        );
        this.bindTexture(
          pass,
          POST_EFFECT_SAMPLER_NAMES.depth,
          DEPTH_SAMPLER_UNIT,
          this.depthTexture,
        );
      });

      [current, next] = [next, current];
    }

    this.drawPass(display, null, () => {
      this.bindTexture(
        display,
        POST_EFFECT_SAMPLER_NAMES.scene,
        0,
        current.texture,
      );
      this.setFloat(
        display,
        POST_EFFECT_TONEMAP_UNIFORM,
        TONEMAP_VALUES[this.tonemap],
      );
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    const passes = [
      ...(this.linearize ? [this.linearize] : []),
      ...this.effects,
      ...(this.display ? [this.display] : []),
    ];
    disposePasses(this.gl, passes);
    this.linearize = null;
    this.effects = [];
    this.display = null;

    disposeTarget(this.gl, this.targetA);
    disposeTarget(this.gl, this.targetB);
    this.targetA = null;
    this.targetB = null;

    if (this.gbufferTexture) {
      this.gl.deleteTexture(this.gbufferTexture);
      this.gbufferTexture = null;
    }
    if (this.depthTexture) {
      this.gl.deleteTexture(this.depthTexture);
      this.depthTexture = null;
    }
  }

  private install(
    linearize: Pass,
    effects: Pass[],
    display: Pass,
    tonemap: TonemapMode,
  ): void {
    const oldPasses = [
      ...(this.linearize ? [this.linearize] : []),
      ...this.effects,
      ...(this.display ? [this.display] : []),
    ];
    disposePasses(this.gl, oldPasses);

    this.linearize = linearize;
    this.effects = effects;
    this.display = display;
    this.tonemap = tonemap;
  }

  private ensureTargets(): boolean {
    if (
      this.targetA &&
      this.targetB &&
      this.targetA.width === this.width &&
      this.targetA.height === this.height
    ) {
      return true;
    }

    const a = this.createTarget(this.width, this.height);
    const b = a ? this.createTarget(this.width, this.height) : null;

    if (!a || !b) {
      if (a) disposeTarget(this.gl, a);
      if (b) disposeTarget(this.gl, b);
      return Boolean(this.targetA && this.targetB);
    }

    disposeTarget(this.gl, this.targetA);
    disposeTarget(this.gl, this.targetB);
    this.targetA = a;
    this.targetB = b;
    return true;
  }

  private createTarget(width: number, height: number): RenderTarget | null {
    const gl = this.gl;
    const formats: TargetFormat[] = [];

    if (this.halfFloatSupported) {
      formats.push({ internalFormat: gl.RGBA16F, type: gl.HALF_FLOAT });
    }
    formats.push({ internalFormat: gl.RGBA8, type: gl.UNSIGNED_BYTE });

    for (const format of formats) {
      const texture = gl.createTexture();
      if (!texture) continue;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        format.internalFormat,
        width,
        height,
        0,
        gl.RGBA,
        format.type,
        null,
      );

      const framebuffer = gl.createFramebuffer();
      if (!framebuffer) {
        gl.deleteTexture(texture);
        continue;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );

      if (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
      ) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { framebuffer, texture, width, height };
      }

      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return null;
  }

  private ensureDummyTextures(): boolean {
    if (!this.gbufferTexture) {
      this.gbufferTexture = this.createSolidTexture([128, 128, 255, 255]);
    }
    if (!this.depthTexture) {
      this.depthTexture = this.createSolidTexture([255, 0, 0, 255]);
    }

    return this.gbufferTexture !== null && this.depthTexture !== null;
  }

  private createSolidTexture(rgba: readonly number[]): WebGLTexture | null {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(rgba),
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  private compileVertexShader(): WebGLShader | null {
    const gl = this.gl;
    this.recorder?.begin();

    const shader = gl.createShader(gl.VERTEX_SHADER);
    if (!shader) return null;

    gl.shaderSource(shader, postEffectShaders.vertex);
    gl.compileShader(shader);
    gl.getShaderInfoLog(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      this.recorder?.drain();
      return null;
    }

    this.recorder?.drain();
    return shader;
  }

  private compilePass(
    vertex: WebGLShader,
    fragment: string,
    source: PostEffectSource | null,
  ): PassCompile {
    const gl = this.gl;
    this.recorder?.begin();

    const shader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!shader) {
      this.recorder?.drain();
      return {
        pass: null,
        errors: [internalError('A post shader could not be allocated.')],
      };
    }

    gl.shaderSource(shader, fragment);
    gl.compileShader(shader);
    gl.getShaderInfoLog(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const records = this.recorder?.drain() ?? [];
      gl.deleteShader(shader);
      return {
        pass: null,
        errors: this.failureErrors(records, source),
      };
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(shader);
      this.recorder?.drain();
      return {
        pass: null,
        errors: [internalError('A post program could not be allocated.')],
      };
    }

    gl.attachShader(program, vertex);
    gl.attachShader(program, shader);
    gl.linkProgram(program);
    gl.getProgramInfoLog(program);
    gl.deleteShader(shader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const records = this.recorder?.drain() ?? [];
      gl.deleteProgram(program);
      return {
        pass: null,
        errors: this.failureErrors(records, source),
      };
    }

    this.recorder?.drain();
    return {
      pass: {
        program,
        locations: new Map(),
        userTarget: source
          ? new SandboxUniformBindingTarget(gl, program, this.textureUnits)
          : null,
      },
      errors: [],
    };
  }

  private failureErrors(
    records: readonly ShaderCompileRecord[],
    source: PostEffectSource | null,
  ): ShaderError[] {
    if (!source) {
      const detail = records
        .map((record) => record.log.trim())
        .filter(Boolean)
        .join('\n');
      return [
        internalError(
          detail.length > 0
            ? detail
            : 'An internal post pass failed to compile.',
        ),
      ];
    }

    const errors = parseShaderCompileErrors(
      records.filter((record) => record.stage !== 'vertex'),
      {
        vertex: source.editorSource,
        fragment: source.editorSource,
        editorSource: {
          vertex: source.editorSource,
          fragment: source.editorSource,
        },
        userData: {
          vertex: null,
          fragment: {
            injected: source.injected,
            declarationRowByLine: source.declarationRowByLine,
          },
        },
      },
      `The post effect "${source.name}" failed to compile.`,
    );

    return errors.map((error) => ({
      ...error,
      stage: error.stage === 'user_data' ? 'user_data' : 'post',
      effectId: source.id,
    }));
  }

  private drawPass(
    pass: Pass,
    target: RenderTarget | null,
    bind: () => void,
  ): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    gl.viewport(
      0,
      0,
      target?.width ?? this.width,
      target?.height ?? this.height,
    );
    gl.useProgram(pass.program);
    bind();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private applyCommonUniforms(
    pass: Pass,
    width: number,
    height: number,
    timeSeconds: number,
  ): void {
    this.setVector2(pass, POST_EFFECT_UNIFORM_NAMES.resolution, width, height);
    this.setVector2(
      pass,
      POST_EFFECT_UNIFORM_NAMES.texelSize,
      1 / Math.max(width, 1),
      1 / Math.max(height, 1),
    );
    this.setFloat(pass, POST_EFFECT_UNIFORM_NAMES.time, timeSeconds);
    this.setFloat(pass, POST_EFFECT_UNIFORM_NAMES.cameraNear, 0);
    this.setFloat(pass, POST_EFFECT_UNIFORM_NAMES.cameraFar, 1);
    this.setVector3(pass, POST_EFFECT_UNIFORM_NAMES.cameraPosition, 0, 0, 0);
    this.setMatrix(pass, POST_EFFECT_UNIFORM_NAMES.projection, IDENTITY_MATRIX);
    this.setMatrix(
      pass,
      POST_EFFECT_UNIFORM_NAMES.inverseProjection,
      IDENTITY_MATRIX,
    );
    this.setMatrix(pass, POST_EFFECT_UNIFORM_NAMES.view, IDENTITY_MATRIX);
    this.setMatrix(
      pass,
      POST_EFFECT_UNIFORM_NAMES.inverseView,
      IDENTITY_MATRIX,
    );
  }

  private bindTexture(
    pass: Pass,
    name: string,
    unit: number,
    texture: WebGLTexture | null,
  ): void {
    if (!texture) return;

    const location = this.location(pass, name);
    if (!location) return;

    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(location, unit);
    gl.activeTexture(gl.TEXTURE0);
  }

  private setFloat(pass: Pass, name: string, value: number): void {
    const location = this.location(pass, name);
    if (location) this.gl.uniform1f(location, value);
  }

  private setVector2(pass: Pass, name: string, x: number, y: number): void {
    const location = this.location(pass, name);
    if (location) this.gl.uniform2f(location, x, y);
  }

  private setVector3(
    pass: Pass,
    name: string,
    x: number,
    y: number,
    z: number,
  ): void {
    const location = this.location(pass, name);
    if (location) this.gl.uniform3f(location, x, y, z);
  }

  private setMatrix(pass: Pass, name: string, matrix: Float32Array): void {
    const location = this.location(pass, name);
    if (location) this.gl.uniformMatrix4fv(location, false, matrix);
  }

  private location(pass: Pass, name: string): WebGLUniformLocation | null {
    const cached = pass.locations.get(name);
    if (cached !== undefined) return cached;

    const location = this.gl.getUniformLocation(pass.program, name);
    pass.locations.set(name, location);
    return location;
  }
}

function disposePasses(
  gl: WebGL2RenderingContext,
  passes: readonly Pass[],
): void {
  for (const pass of passes) gl.deleteProgram(pass.program);
}

function disposeTarget(
  gl: WebGL2RenderingContext,
  target: RenderTarget | null,
): void {
  if (!target) return;
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

function internalError(message: string): ShaderError {
  return {
    stage: 'post',
    line: null,
    column: null,
    kind: 'internal',
    title: 'Post effect pipeline failed',
    message,
    advice: 'Reload the preview. If it persists, report the error.',
  };
}
