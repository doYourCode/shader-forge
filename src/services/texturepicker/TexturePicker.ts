import type { SamplerKind, UserTextureSource } from '@/core/models/userUniform';

/**
 * Narrow port between the texture widget and whichever picker implementation
 * is mounted. It deliberately exposes no AssetPicker types: cancellation and
 * rejection are ordinary results, not exceptions, and the result promise never
 * rejects.
 */
export interface TexturePickRequest {
  readonly sampler: SamplerKind;
}

export type TexturePickRejection = 'unsupported-asset' | 'picker-unavailable';

export type TexturePickResult =
  | { readonly status: 'picked'; readonly source: UserTextureSource }
  | { readonly status: 'cancelled' }
  | { readonly status: 'rejected'; readonly reason: TexturePickRejection };

export interface TexturePickerSession {
  readonly result: Promise<TexturePickResult>;
  /**
   * Settles once the picker has mounted, or once it is clear it never will
   * (unavailable module, early disposal). It never rejects: a failed mount is
   * reported through {@link result}, so callers can always use it to stop a
   * loading state.
   */
  readonly ready: Promise<void>;
  dispose(): void;
}

export interface TexturePickerPort {
  /**
   * Warms implementation code without opening a session. Idempotent and safe
   * to call from pointer/focus handlers; failures are retried by the next
   * `open()`.
   */
  preload(): void;
  open(request: TexturePickRequest, host: HTMLElement): TexturePickerSession;
}
