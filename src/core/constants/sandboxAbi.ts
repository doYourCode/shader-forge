/**
 * The tiny ABI of the 2D Sandbox.
 *
 * The sandbox has no editable vertex stage: one internal fullscreen triangle
 * supplies `vUv`, and the engine supplies resolution and time. Keeping the
 * contract in a pure module lets the generated ABI reference import it without
 * pulling the `?raw` shader assets (or a bundler) into the generator.
 */

export interface SandboxAbiSpec {
  readonly qualifier: 'in' | 'uniform';
  readonly glslType: 'vec2' | 'float';
  /** Description shown by the generated ABI reference. */
  readonly hint: string;
}

export const SANDBOX_ABI_SPECS = {
  vUv: {
    qualifier: 'in',
    glslType: 'vec2',
    hint: 'Normalised screen coordinate from the internal fullscreen triangle; xy in [0, 1].',
  },
  uResolution: {
    qualifier: 'uniform',
    glslType: 'vec2',
    hint: 'Drawing-buffer size in pixels (already multiplied by the capped device pixel ratio).',
  },
  uTime: {
    qualifier: 'uniform',
    glslType: 'float',
    hint: 'Seconds since the preview started; frozen while paused.',
  },
} as const satisfies Record<string, SandboxAbiSpec>;

/** Names the sandbox ABI already owns and user data may not redeclare. */
export const SANDBOX_ABI_NAMES: readonly string[] =
  Object.keys(SANDBOX_ABI_SPECS);
