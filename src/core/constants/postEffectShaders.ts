import postVertexShader from '@/assets/internal-shaders/post.vert.glsl?raw';
import postLinearizeFragment from '@/assets/internal-shaders/post.linearize.frag.glsl?raw';
import postDisplayFragment from '@/assets/internal-shaders/post.display.frag.glsl?raw';

/**
 * Platform-neutral internal shader sources for the post-effect chain.
 *
 * The Babylon pipeline and the 2D sandbox both use the same linearize and
 * display passes; only the platform-specific pipeline differs. Keeping these
 * out of `services/babylon` lets the sandbox stay Babylon-free.
 */
export const postEffectShaders = {
  vertex: postVertexShader,
  linearize: postLinearizeFragment,
  display: postDisplayFragment,
} as const;
