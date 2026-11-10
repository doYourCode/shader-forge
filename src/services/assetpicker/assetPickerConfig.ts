import type { AssetPickerConfig } from 'assetpicker';

import type { TexturePickRequest } from '@/services/texturepicker/TexturePicker';

/** Key of the bundled repository storage in the picker's config. */
export const REPOSITORY_STORAGE_ID = 'bundled-textures';

/** Adapter type registered for the bundled repository storage. */
export const REPOSITORY_ADAPTER_ID = 'shaderforge-bundled-textures';

export interface AssetPickerLabels {
  /** Dialog title shown by our modal and the picker itself. */
  readonly title: string;
  /** Sidebar label for the bundled textures storage. */
  readonly storage: string;
}

export type AssetPickerLanguage = 'en' | 'de';

/**
 * Projects one sampler request onto an AssetPicker configuration.
 *
 * Only the storage matching the requested sampler is configured, so a cube
 * uniform can never be offered a 2D image. GitHub/Drive/dummy storages are
 * deliberately absent: this iteration has no mapping for their assets.
 */
export function buildAssetPickerConfig(
  request: TexturePickRequest,
  labels: AssetPickerLabels,
  language: AssetPickerLanguage,
): AssetPickerConfig {
  return {
    title: labels.title,
    language,
    pick: { limit: 1, types: ['file'], extensions: [] },
    thumbnails: 'url',
    storages: {
      [REPOSITORY_STORAGE_ID]: {
        adapter: REPOSITORY_ADAPTER_ID,
        label: labels.storage,
        sampler: request.sampler,
      },
    },
  };
}

/**
 * AssetPicker ships only English and German. The host defaults to pt-BR, so
 * every non-German locale deliberately falls back to English.
 */
export function toAssetPickerLanguage(locale: string): AssetPickerLanguage {
  return locale.toLowerCase().startsWith('de') ? 'de' : 'en';
}
