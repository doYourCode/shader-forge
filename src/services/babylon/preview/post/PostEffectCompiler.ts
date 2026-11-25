import {
  Constants,
  Effect,
  PostProcess,
  type AbstractEngine,
} from '@babylonjs/core';
import type { PostEffectSource } from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import {
  parseShaderCompileErrors,
  type ShaderCompileRecord,
} from '@/core/utils/shaderErrors';
import type { ShaderLogRecorder } from '@/services/gpu/ShaderLogRecorder';
import { EffectPipelineCache } from '../compile/EffectPipelineCache';

export interface PostEffectCompilerOptions {
  readonly timeoutMs: number;
  readonly pollMs: number;
}

const DEFAULT_OPTIONS: PostEffectCompilerOptions = {
  timeoutMs: 15_000,
  pollMs: 32,
};

export interface PostEffectPassRequest {
  /** Unique shader/pass name; also the key of the compiled pipeline. */
  readonly name: string;
  readonly fragment: string;
  readonly uniforms: readonly string[];
  readonly samplers: readonly string[];
  /** Null for internal passes, which have no editable source. */
  readonly source: PostEffectSource | null;
}

export type PostEffectPassResult =
  | { readonly ok: true; readonly postProcess: PostProcess }
  | { readonly ok: false; readonly errors: readonly ShaderError[] };

/**
 * Compiles one post-process pass and owns its effect lifecycle.
 *
 * The pass is created detached from the camera so a broken effect can be
 * rejected without disturbing the chain that is currently rendering. Raw
 * driver logs come from the shared recorder (the same source of truth used by
 * the surface-shader compiler), and a failed pipeline is evicted from
 * Babylon's cache before the pass is disposed so the next attempt really
 * recompiles.
 */
export class PostEffectCompiler {
  private readonly engine: AbstractEngine;
  private readonly recorder: ShaderLogRecorder | null;
  private readonly textureType: number;
  private readonly options: PostEffectCompilerOptions;

  constructor(
    engine: AbstractEngine,
    recorder: ShaderLogRecorder | null,
    textureType: number,
    options: PostEffectCompilerOptions = DEFAULT_OPTIONS,
  ) {
    this.engine = engine;
    this.recorder = recorder;
    this.textureType = textureType;
    this.options = options;
  }

  async compile(request: PostEffectPassRequest): Promise<PostEffectPassResult> {
    if (isContextLost(this.engine)) {
      return { ok: false, errors: [contextLostError()] };
    }

    // One batch per attempt: an overlapping surface compile cannot be told
    // apart from this one, so callers serialize compiles.
    this.recorder?.begin();

    let outcome: 'compiled' | 'failed' | null = null;
    let fallback = '';

    // PostProcess resolves its fragment through the shader store, so the
    // source is registered under a per-compile key. The key is removed once
    // PostProcess resolves its fragment through the shader store under
    // `<name>FragmentShader`, so the source is registered under that key. The
    // key is removed once the driver has answered; the effect keeps its own
    // copy of the code.
    const fragmentShader = request.name;
    const fragmentKey = `${fragmentShader}FragmentShader`;
    Effect.ShadersStore[fragmentKey] = request.fragment;

    try {
      const postProcess = new PostProcess(request.name, fragmentShader, {
        engine: this.engine,
        uniforms: [...request.uniforms],
        samplers: [...request.samplers],
        samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
        textureType: this.textureType,
        textureFormat: Constants.TEXTUREFORMAT_RGBA,
      });

      // PostProcess does not forward compile callbacks to its Effect, so the
      // failure signal is attached directly. Without it a broken shader would
      // only surface as a timeout.
      const effect = postProcess.getEffect();
      if (effect) {
        effect.onError = (_failed, errors) => {
          outcome = 'failed';
          fallback = errors;
        };
      }

      const ready = await this.waitUntilReady(postProcess, () => outcome);

      if (ready === 'compiled') {
        this.recorder?.drain();
        return { ok: true, postProcess };
      }

      let errors: ShaderError[];
      if (ready === 'context-lost') {
        errors = [contextLostError()];
        this.recorder?.drain();
      } else if (ready === 'failed') {
        errors = this.mapErrors(
          this.recorder?.drain() ?? [],
          request.source,
          fallback,
        );
      } else {
        errors = [timeoutError(request, this.options.timeoutMs)];
      }

      EffectPipelineCache.evict(postProcess.getEffect());
      postProcess.dispose();

      return { ok: false, errors };
    } finally {
      // Also runs when PostProcess construction throws.
      delete Effect.ShadersStore[fragmentKey];
    }
  }

  /**
   * Polls the effect until the driver reports success or failure. Babylon
   * compiles asynchronously when parallel shader compilation is available, so
   * a single `isReady()` check is not enough.
   */
  private waitUntilReady(
    postProcess: PostProcess,
    outcome: () => 'compiled' | 'failed' | null,
  ): Promise<'compiled' | 'failed' | 'timeout' | 'context-lost'> {
    const started = performance.now();

    return new Promise((resolve) => {
      const poll = (): void => {
        try {
          // Do not sit in the 15 s timeout when the GPU is already gone.
          if (isContextLost(this.engine)) {
            resolve('context-lost');
            return;
          }

          const current = outcome();
          if (current !== null) {
            resolve(current);
            return;
          }

          // `isReady` stays false forever after a failed compile; the driver
          // message is the only signal that the pass will never be usable.
          if (postProcess.getEffect()?.getCompilationError()) {
            resolve('failed');
            return;
          }

          if (postProcess.isReady()) {
            resolve('compiled');
            return;
          }

          if (performance.now() - started > this.options.timeoutMs) {
            resolve('timeout');
            return;
          }

          window.setTimeout(poll, this.options.pollMs);
        } catch {
          resolve('failed');
        }
      };

      poll();
    });
  }

  /**
   * Maps driver diagnostics to editor diagnostics. Link/fallback errors have
   * no stage of their own, and every error belongs to the effect document, so
   * fragment and program stages collapse into `post`.
   */
  private mapErrors(
    records: readonly ShaderCompileRecord[],
    source: PostEffectSource | null,
    fallback: string,
  ): ShaderError[] {
    if (!source) {
      return [internalPassError(fallback)];
    }

    const stageRecords = records.filter((record) => record.stage !== 'vertex');

    const errors = parseShaderCompileErrors(
      stageRecords,
      {
        // A post effect is fragment-only: both stage slots point at the same
        // document so line mapping has an editor source to translate into.
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
      fallback,
    );

    return errors.map((error) => ({
      ...error,
      stage: error.stage === 'user_data' ? 'user_data' : 'post',
      effectId: source.id,
    }));
  }
}

function timeoutError(
  request: PostEffectPassRequest,
  timeoutMs: number,
): ShaderError {
  return {
    stage: 'post',
    line: null,
    column: null,
    kind: 'timeout',
    title: 'Post effect compilation timed out',
    message: `The driver did not finish compiling "${request.name}" within ${timeoutMs} ms.`,
    advice: 'Reduce the shader complexity and compile again.',
    effectId: request.source?.id,
  };
}

function internalPassError(fallback: string): ShaderError {
  return {
    stage: 'post',
    line: null,
    column: null,
    kind: 'internal',
    title: 'Post effect pipeline failed to initialize',
    message:
      fallback || 'An internal post-processing pass could not be compiled.',
    advice: 'Reload the preview. If it persists, report the error.',
  };
}

function contextLostError(): ShaderError {
  return {
    stage: 'post',
    line: null,
    column: null,
    kind: 'internal',
    title: 'WebGL context lost',
    message:
      'The GPU context was lost while compiling the post-effect pipeline.',
    advice:
      'Reload the page to rebuild the preview. If it repeats, lower the shader cost or update the browser/driver.',
  };
}

/** Babylon exposes the live GL context only through the private `_gl` field. */
function isContextLost(engine: AbstractEngine): boolean {
  const context = (engine as unknown as { _gl?: WebGL2RenderingContext })._gl;
  return context?.isContextLost?.() ?? false;
}
