import type { ShaderCompileRecord } from '@/core/utils/shaderErrors';

/**
 * The subset of the WebGL context this recorder needs. Keeping it structural
 * means the recorder can be unit-tested with a fake context and does not
 * depend on Babylon.
 */
export interface WebGlInfoLogContext {
  readonly VERTEX_SHADER: number;
  readonly FRAGMENT_SHADER: number;
  readonly SHADER_TYPE: number;
  getShaderInfoLog(shader: WebGLShader): string | null;
  getProgramInfoLog(program: WebGLProgram): string | null;
  getShaderParameter(shader: WebGLShader, pname: number): unknown;
  getShaderSource(shader: WebGLShader): string | null;
}

/**
 * WebGL is the only place where the exact compiler diagnostics exist.
 * Babylon stores `error.stack` in `Effect._compilationError`, which loses the
 * driver message entirely on Firefox (its stack strings do not include the
 * error message). This recorder observes `getShaderInfoLog` and
 * `getProgramInfoLog` at the GL boundary, so ShaderForge always has the real
 * log, the shader stage, and the source the line numbers refer to.
 */
export class ShaderLogRecorder {
  private readonly context: WebGlInfoLogContext;
  private readonly originalGetShaderInfoLog: (
    shader: WebGLShader,
  ) => string | null;
  private readonly originalGetProgramInfoLog: (
    program: WebGLProgram,
  ) => string | null;
  private records: ShaderCompileRecord[] = [];
  private disposed = false;
  private patched = false;

  constructor(context: WebGlInfoLogContext) {
    this.context = context;
    this.originalGetShaderInfoLog = context.getShaderInfoLog.bind(context);
    this.originalGetProgramInfoLog = context.getProgramInfoLog.bind(context);

    this.patched = true;
    try {
      context.getShaderInfoLog = (shader) => this.captureShaderLog(shader);
      context.getProgramInfoLog = (program) => this.captureProgramLog(program);
    } catch {
      // Some hosts expose read-only WebGL methods. Failing to instrument is
      // non-fatal: the parser still falls back to Babylon's error string.
      this.restore();
    }
  }

  /** Starts a new compilation batch, discarding logs from earlier attempts. */
  begin(): void {
    this.records = [];
  }

  /** Returns the captured logs and clears the current batch. */
  drain(): ShaderCompileRecord[] {
    const records = this.records;
    this.records = [];
    return records;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.restore();
  }

  private captureShaderLog(shader: WebGLShader): string | null {
    const log = this.originalGetShaderInfoLog(shader);
    const message = log?.trim();

    if (!this.disposed && message) {
      this.records.push({
        stage: this.stageOf(shader),
        log: message,
        source: this.sourceOf(shader),
      });
    }

    return log;
  }

  private captureProgramLog(program: WebGLProgram): string | null {
    const log = this.originalGetProgramInfoLog(program);
    const message = log?.trim();

    if (!this.disposed && message) {
      this.records.push({
        stage: 'program',
        log: message,
        source: null,
      });
    }

    return log;
  }

  private stageOf(shader: WebGLShader): 'vertex' | 'fragment' {
    try {
      const type = this.context.getShaderParameter(
        shader,
        this.context.SHADER_TYPE,
      );
      return type === this.context.FRAGMENT_SHADER ? 'fragment' : 'vertex';
    } catch {
      // The stage is only used for labelling/mapping. If it cannot be read,
      // vertex is a safe default because the parser still uses the log text.
      return 'vertex';
    }
  }

  private sourceOf(shader: WebGLShader): string | null {
    try {
      return this.context.getShaderSource(shader);
    } catch {
      return null;
    }
  }

  private restore(): void {
    if (!this.patched) return;
    this.patched = false;

    try {
      this.context.getShaderInfoLog = this.originalGetShaderInfoLog;
    } catch {
      // The context may already be lost/disposed.
    }

    try {
      this.context.getProgramInfoLog = this.originalGetProgramInfoLog;
    } catch {
      // The context may already be lost/disposed.
    }
  }
}
