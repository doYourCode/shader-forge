import defaultPostEffectFragment from '@/assets/internal-shaders/post.default.frag.glsl?raw';
import type { PostEffectDocument } from '@/core/models/postEffect';

export { defaultPostEffectFragment };

/**
 * The fragment a fresh effect starts from: a valid passthrough that documents
 * the view-space ABI. Effects are additive to the app state, never loaded over
 * the surface shader documents.
 */
export function createDefaultPostEffect(
  id: string,
  name = 'Pass through',
): PostEffectDocument {
  return {
    id,
    name,
    enabled: true,
    fragment: defaultPostEffectFragment,
  };
}
