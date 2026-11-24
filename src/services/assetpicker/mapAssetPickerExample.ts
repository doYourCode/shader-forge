import type { AssetPickerItem } from 'assetpicker';

import type { ShaderExampleCatalog } from '@/core/constants/shaderExamples';
import type { ExamplePickResult } from './ExamplePicker';

import { EXAMPLE_STORAGE_ID } from './examplePickerConfig';

const REJECTED: ExamplePickResult = {
  status: 'rejected',
  reason: 'unsupported-example',
};

/**
 * Anti-corruption layer between AssetPicker's item shape and the example id.
 *
 * Only files listed by the bundled-examples storage are mapped: folders and
 * foreign storages are rejected rather than coerced, and the catalog must
 * still know the id so a stale item can never load a removed example.
 */
export function mapAssetPickerExample(
  item: AssetPickerItem,
  catalog: ShaderExampleCatalog,
): ExamplePickResult {
  if (item.type !== 'file' || item.storage !== EXAMPLE_STORAGE_ID) {
    return REJECTED;
  }

  const example = catalog.find(item.id);
  if (!example) return REJECTED;

  return { status: 'picked', exampleId: example.id };
}
