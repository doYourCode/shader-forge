// Vite's `?raw` suffix inlines the file content as a string at build time.
// This keeps shaders as real .glsl files (editor highlighting, linting)
// while still shipping them in the bundle — no runtime fetch needed.
import defaultVertex from '@/assets/internal-shaders/default.vert.glsl?raw';
import defaultFragment from '@/assets/internal-shaders/default.frag.glsl?raw';
import errorVertex from '@/assets/internal-shaders/error.vert.glsl?raw';
import errorFragment from '@/assets/internal-shaders/error.frag.glsl?raw';

export interface InternalShaderPair {
  vertex: string;
  fragment: string;
}

/**
 * Shaders used internally by SceneManager (not user-edited).
 * Grouped here so the SceneManager doesn't need to know how they're sourced.
 */
export const internalShaders = {
  /** Used to render a placeholder when a user shader fails to compile. */
  error: {
    vertex: errorVertex,
    fragment: errorFragment,
  } satisfies InternalShaderPair,

  /**
   * A known-good vertex shader used to validate the fragment stage on its own.
   * The vertex is GLSL ES 3.00, which links with user fragments of either
   * version: Babylon upgrades sources without #version before compiling.
   */
  validation: {
    vertex: defaultVertex,
    fragment: defaultFragment,
  } satisfies InternalShaderPair,
} as const;