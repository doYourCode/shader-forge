import defaultFragment from '@/assets/internal-shaders/post.screenspace.frag.glsl?raw';
import type { PostEffectDocument } from '@/core/models/postEffect';

export { defaultFragment as defaultScreenSpaceEffectFragment };

/**
 * A fresh screen-space effect starts as a valid passthrough that documents the
 * whole G-buffer ABI. Unlike the surface editor's post stack, this one can
 * sample the original HDR scene colour and every scene G-buffer attachment.
 */
export function createScreenSpaceEffect(
  id: string,
  name = 'Passthrough',
): PostEffectDocument {
  return {
    id,
    name,
    enabled: true,
    fragment: defaultFragment,
  };
}
