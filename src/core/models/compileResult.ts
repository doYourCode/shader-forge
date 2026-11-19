import type { ShaderError } from './shaderError';

/**
 * Why a compile could not even reach the driver. These are not shader errors:
 * they mean the preview or the request was not in a state where compiling is
 * meaningful, so the caller must not present them as driver diagnostics.
 */
export type CompileUnavailableReason =
  'scene-not-initialized' | 'scene-disposed' | 'compile-superseded';

/**
 * The user-facing outcome of a compile request.
 *
 * A discriminated union so a caller cannot read `errors` without narrowing, and
 * cannot mistake "the preview is not ready" for a driver failure.
 */
export type CompileResult =
  | { readonly status: 'ok' }
  | { readonly status: 'failed'; readonly errors: readonly ShaderError[] }
  | {
      readonly status: 'unavailable';
      readonly reason: CompileUnavailableReason;
    };
