import type { SamplerKind } from '@/core/models/userUniform';

/** How the bundled asset is sampled, independent of its sampler declaration. */
export type PreviewTextureFormat = 'image' | 'cubemap';

/**
 * A texture bundled with the repository and offered by the user-data picker.
 * The `id` is stable and is what user uniforms persist; `url` is a build-time
 * asset URL and must never be stored as the uniform value.
 */
export interface PreviewTexture {
  /** Stable kebab-case id; what uniforms store. */
  readonly id: string;
  /** Human-readable name shown in the picker. */
  readonly label: string;
  /** Vite `?url` import, resolved at build time. */
  readonly url: string;
  /**
   * Optional small preview (Vite build-time URL). Pickers should fall back to
   * `url` when absent, but catalog entries are expected to provide one so the
   * grid does not decode full-resolution textures.
   */
  readonly thumbnailUrl?: string;
  /** The only uniform kind this asset can be bound to. */
  readonly sampler: SamplerKind;
  readonly format: PreviewTextureFormat;
}
