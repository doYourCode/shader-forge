import type { AssetPickerConfig } from 'assetpicker';

import type { AssetPickerLanguage } from './assetPickerConfig';

/** Key of the bundled shader-example storage in the picker's config. */
export const EXAMPLE_STORAGE_ID = 'bundled-examples';

/** Adapter type registered for the bundled shader-example storage. */
export const EXAMPLE_ADAPTER_ID = 'shaderforge-examples';

export interface ExamplePickerLabels {
  /** Dialog title shown by our modal and the picker itself. */
  readonly title: string;
  /** Sidebar label for the bundled examples storage. */
  readonly storage: string;
}

/**
 * Projects the example picker onto an AssetPicker configuration.
 *
 * Only one storage is configured, so the picker opens straight into the
 * folder grid instead of a storage overview. Each group is a folder and its
 * examples are the files inside it.
 */
export function buildExamplePickerConfig(
  labels: ExamplePickerLabels,
  language: AssetPickerLanguage,
): AssetPickerConfig {
  return {
    title: labels.title,
    language,
    pick: { limit: 1, types: ['file'], extensions: [] },
    thumbnails: 'url',
    autoOpenSingleStorage: true,
    storages: {
      [EXAMPLE_STORAGE_ID]: {
        adapter: EXAMPLE_ADAPTER_ID,
        label: labels.storage,
      },
    },
  };
}
