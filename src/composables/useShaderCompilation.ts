import { ref } from 'vue';

import type {
  CompileResult,
  CompileUnavailableReason,
} from '@/core/models/compileResult';
import type { PostEffectStack } from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import type { MaterialBlueprint } from '@/core/models/shaderSource';

export type EditorStatus = 'idle' | 'ready' | 'error' | 'compiling';

/**
 * A status-bar message as a translation key plus its parameters. The view
 * translates it on render, so switching the UI language updates the message
 * instead of freezing the language it was produced in.
 */
export interface EditorStatusMessage {
  readonly key: string;
  readonly params?: Record<string, unknown>;
}

/** Which document family the Compile button (and structural edits) target. */
export type CompileTarget = 'material' | 'post';

export interface ShaderCompilationDeps {
  readonly compileMaterial: (
    blueprint: MaterialBlueprint,
  ) => Promise<CompileResult>;
  readonly compilePostEffects: (
    stack: PostEffectStack,
  ) => Promise<CompileResult>;
  readonly getMaterialBlueprint: () => MaterialBlueprint;
  readonly getPostStack: () => PostEffectStack;
  /** Flush the active editor buffer before the request is built. */
  readonly onBeforeCompile: () => void;
  /** Called after every applied outcome (diagnostics, reveal routing). */
  readonly onOutcome: (result: CompileResult) => void;
  /** Driver-time errors that arrive outside a compile request. */
  readonly onExternalErrors: (errors: readonly ShaderError[]) => void;
}

/** Why a compile could not run at all, as status-bar message keys. */
const UNAVAILABLE_MESSAGE_KEYS: Record<CompileUnavailableReason, string> = {
  'scene-not-initialized':
    'editor.status.messages.unavailable.sceneNotInitialized',
  'scene-disposed': 'editor.status.messages.unavailable.sceneDisposed',
  'compile-superseded': 'editor.status.messages.unavailable.superseded',
};

interface QueuedCompile {
  readonly kind: CompileTarget;
  readonly run: () => Promise<CompileResult>;
  readonly settle: () => void;
}

/**
 * The single owner of compilation state: the error list, the status bar, and
 * the request queue.
 *
 * Material and post-effect compiles share the WebGL log recorder, so exactly
 * one may run at a time. They also coalesce per family: a newer material
 * request replaces one that has not started yet, and the same for post-effect
 * stacks. That replaces the previous three mechanisms (a serialization chain,
 * a material in-flight/queued pair and a post one) with one queue.
 */
export function useShaderCompilation(deps: ShaderCompilationDeps) {
  const status = ref<EditorStatus>('idle');
  const statusMessage = ref<EditorStatusMessage | null>(null);
  const errors = ref<ShaderError[]>([]);
  const target = ref<CompileTarget>('material');

  const queue: QueuedCompile[] = [];
  let draining = false;

  function enqueue(
    kind: CompileTarget,
    run: () => Promise<CompileResult>,
  ): Promise<void> {
    // Latest-wins per family: a request that never started is superseded.
    const stale = queue.findIndex((job) => job.kind === kind);
    if (stale >= 0) {
      const [superseded] = queue.splice(stale, 1);
      superseded?.settle();
    }

    return new Promise<void>((settle) => {
      queue.push({ kind, run, settle });
      void drainQueue();
    });
  }

  async function drainQueue(): Promise<void> {
    if (draining) return;
    draining = true;

    try {
      while (queue.length > 0) {
        const job = queue.shift();
        if (!job) continue;

        try {
          await execute(job);
        } catch {
          // A consumer (onOutcome) failed after the result was applied. The
          // job is settled, and the remaining queue must still drain.
        }
      }
    } finally {
      draining = false;
    }
  }

  async function execute(job: QueuedCompile): Promise<void> {
    status.value = 'compiling';
    statusMessage.value = {
      key:
        job.kind === 'material'
          ? 'editor.status.messages.compiling'
          : 'editor.status.messages.compilingPost',
    };

    let result: CompileResult;
    try {
      deps.onBeforeCompile();
      result = await job.run();
    } catch (error) {
      result = internalFailure(job.kind, error);
    }

    try {
      applyResult(result);
      deps.onOutcome(result);
    } finally {
      // The queue must keep draining even if a consumer throws while reacting.
      job.settle();
    }
  }

  function applyResult(result: CompileResult): void {
    if (result.status === 'ok') {
      errors.value = [];
      status.value = 'ready';
      statusMessage.value = { key: 'editor.status.messages.compiled' };
      return;
    }

    if (result.status === 'unavailable') {
      errors.value = [];
      status.value = 'error';
      statusMessage.value = { key: UNAVAILABLE_MESSAGE_KEYS[result.reason] };
      return;
    }

    errors.value = [...result.errors];
    status.value = 'error';
    statusMessage.value =
      result.errors.length > 0
        ? formatErrorStatus(result.errors)
        : { key: 'editor.status.messages.linkFailed' };
  }

  /** Compiles whichever document family is currently being edited. */
  function compile(): Promise<void> {
    return target.value === 'post' ? compilePostEffects() : compileMaterial();
  }

  function compileMaterial(blueprint?: MaterialBlueprint): Promise<void> {
    return enqueue('material', () =>
      deps.compileMaterial(blueprint ?? deps.getMaterialBlueprint()),
    );
  }

  function compilePostEffects(): Promise<void> {
    return enqueue('post', () => deps.compilePostEffects(deps.getPostStack()));
  }

  /**
   * Errors the driver reports outside a compile request (for example a
   * Babylon-triggered recompile). They enter the same state as a compile
   * failure so the status bar and the error list cannot disagree.
   */
  function reportErrors(reported: ShaderError[]): void {
    errors.value = reported;
    status.value = 'error';
    statusMessage.value = formatErrorStatus(reported);
    deps.onExternalErrors(reported);
  }

  /** Drops stale diagnostics without changing the status (used before a load). */
  function clearErrors(): void {
    errors.value = [];
  }

  function setTarget(next: CompileTarget): void {
    target.value = next;
  }

  function setIdle(message: EditorStatusMessage): void {
    status.value = 'idle';
    statusMessage.value = message;
  }

  function setReady(message: EditorStatusMessage): void {
    status.value = 'ready';
    statusMessage.value = message;
  }

  return {
    status,
    statusMessage,
    errors,
    target,
    compile,
    compileMaterial,
    compilePostEffects,
    reportErrors,
    clearErrors,
    setTarget,
    setIdle,
    setReady,
  };
}

function formatErrorStatus(
  shaderErrors: readonly ShaderError[],
): EditorStatusMessage {
  const first = shaderErrors.find((error) => error.line !== null);

  return {
    key:
      first?.line != null
        ? 'editor.status.messages.shaderErrorsAtLine'
        : 'editor.status.messages.shaderErrors',
    params: { count: shaderErrors.length, line: first?.line },
  };
}

/** A thrown compile call becomes a diagnostic, never an unhandled rejection. */
function internalFailure(kind: CompileTarget, error: unknown): CompileResult {
  const message = error instanceof Error ? error.message : String(error);

  return {
    status: 'failed',
    errors: [
      {
        stage: kind === 'post' ? 'post' : 'program',
        line: null,
        column: null,
        kind: 'internal',
        title:
          kind === 'post'
            ? 'Post effect compilation failed'
            : 'Shader compilation failed',
        message,
        advice: null,
      },
    ],
  };
}
