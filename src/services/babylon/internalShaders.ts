// Vite's `?raw` suffix inlines the file content as a string at build time.
// This keeps shaders as real .glsl files (editor highlighting, linting)
// while still shipping them in the bundle — no runtime fetch needed.
import defaultVertex from '@/assets/internal-shaders/default.vert.glsl?raw';
import defaultFragment from '@/assets/internal-shaders/default.frag.glsl?raw';
import errorVertex from '@/assets/internal-shaders/error.vert.glsl?raw';
import errorFragment from '@/assets/internal-shaders/error.frag.glsl?raw';
import gbufferFragment from '@/assets/internal-shaders/post.gbuffer.frag.glsl?raw';
import gbufferVertex from '@/assets/internal-shaders/post.gbuffer.vert.glsl?raw';
import depthFragment from '@/assets/internal-shaders/post.depth.frag.glsl?raw';
import depthVertex from '@/assets/internal-shaders/post.depth.vert.glsl?raw';
import linearizeFragment from '@/assets/internal-shaders/post.linearize.frag.glsl?raw';
import displayFragment from '@/assets/internal-shaders/post.display.frag.glsl?raw';

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

  /**
   * Stages of the view-space post-effect pipeline. Only the user's effect
   * fragment is editable; the linear conversion, the display transform and the
   * normal/depth prepass are fixed.
   */
  post: {
    linearize: linearizeFragment,
    display: displayFragment,
    gbuffer: {
      vertex: gbufferVertex,
      fragment: gbufferFragment,
    },
    depth: {
      vertex: depthVertex,
      fragment: depthFragment,
    },
  } satisfies {
    linearize: string;
    display: string;
    gbuffer: InternalShaderPair;
    depth: InternalShaderPair;
  },
} as const;
