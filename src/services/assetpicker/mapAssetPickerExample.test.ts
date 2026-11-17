import { describe, expect, it } from 'vitest';
import type { AssetPickerItem } from 'assetpicker';

import { shaderExampleCatalog } from '@/core/constants/shaderExamples';

import { EXAMPLE_STORAGE_ID } from './examplePickerConfig';
import { mapAssetPickerExample } from './mapAssetPickerExample';

function item(overrides: Partial<AssetPickerItem> = {}): AssetPickerItem {
  return {
    id: 'phong',
    storage: EXAMPLE_STORAGE_ID,
    name: 'Phong',
    type: 'file',
    ...overrides,
  };
}

describe('mapAssetPickerExample', () => {
  it('maps a bundled example file to its id', () => {
    expect(mapAssetPickerExample(item(), shaderExampleCatalog)).toEqual({
      status: 'picked',
      exampleId: 'phong',
    });
  });

  it('rejects folders', () => {
    expect(
      mapAssetPickerExample(
        item({ type: 'dir', id: 'lighting' }),
        shaderExampleCatalog,
      ),
    ).toEqual({ status: 'rejected', reason: 'unsupported-example' });
  });

  it('rejects items from another storage', () => {
    expect(
      mapAssetPickerExample(
        item({ storage: 'bundled-textures' }),
        shaderExampleCatalog,
      ),
    ).toEqual({ status: 'rejected', reason: 'unsupported-example' });
  });

  it('rejects ids the catalog no longer knows', () => {
    expect(
      mapAssetPickerExample(
        item({ id: 'removed-example' }),
        shaderExampleCatalog,
      ),
    ).toEqual({ status: 'rejected', reason: 'unsupported-example' });
  });
});
