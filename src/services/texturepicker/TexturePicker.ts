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
  dispose(): void;
}

export interface TexturePickerPort {
  open(request: TexturePickRequest, host: HTMLElement): TexturePickerSession;
}
