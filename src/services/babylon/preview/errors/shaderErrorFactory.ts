import type { ShaderError } from '@/core/models/shaderError';

/**
 * Error objects reported by the preview. Keeping their construction here means
 * every caller produces field-for-field identical diagnostics.
 */

/** Normalizes any thrown value to the message a `ShaderError` should carry. */
export function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function internalError(message: string): ShaderError {
  return {
    stage: 'program',
    line: null,
    column: null,
    kind: 'internal',
    title: 'Shader compilation failed',
    message,
    advice: null,
  };
}

export function internalErrorFrom(e: unknown): ShaderError {
  return internalError(toMessage(e));
}

export function timeoutError(timeoutMs: number): ShaderError {
  return {
    stage: 'program',
    line: null,
    column: null,
    kind: 'timeout',
    title: 'Compilation timed out',
    message: `The shader compiler did not finish within ${
      timeoutMs / 1000
    } seconds.`,
    advice:
      'The shader may be too complex for this GPU. Simplify loops or reduce function calls, then compile again.',
  };
}

export function webGl2RequiredError(): ShaderError {
  return {
    stage: 'program',
    line: null,
    column: null,
    kind: 'internal',
    title: 'WebGL 2 is required',
    message:
      'WebGL 2 is required to render the shader preview, but the browser created a WebGL 1 context.',
    advice:
      'Use a browser or device with WebGL 2 support, and make sure hardware acceleration is enabled.',
  };
}
