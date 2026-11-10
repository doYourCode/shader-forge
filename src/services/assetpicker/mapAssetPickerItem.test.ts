import { describe, expect, it } from 'vitest';
import type { AssetPickerItem } from 'assetpicker';

import type { TextureCatalog } from '@/core/constants/previewTextures';
import type { PreviewTexture } from '@/core/models/previewTexture';

import { REPOSITORY_STORAGE_ID } from './assetPickerConfig';
import { mapAssetPickerItem } from './mapAssetPickerItem';

const TEXTURES: readonly PreviewTexture[] = [
  {
    id: 'uv-checker-01',
    label: 'UV Checker 01',
    url: 'https://cdn.example/textures/uv-checker-01.png',
    sampler: 'sampler2D',
    format: 'image',
  },
  {
    id: 'cube-sky',
    label: 'Cube Sky',
    url: 'https://cdn.example/textures/cube-sky.png',
    sampler: 'samplerCube',
    format: 'cubemap',
  },
];

const CATALOG: TextureCatalog = {
  find: (id) => TEXTURES.find((texture) => texture.id === id),
  forSampler: (sampler) =>
    TEXTURES.filter((texture) => texture.sampler === sampler),
};

function item(overrides: Partial<AssetPickerItem> = {}): AssetPickerItem {
  return {
    id: 'uv-checker-01',
    storage: REPOSITORY_STORAGE_ID,
    name: 'UV Checker 01',
    type: 'file',
    thumbnail: 'https://cdn.example/textures/uv-checker-01.png',
    links: { open: 'https://cdn.example/textures/uv-checker-01.png' },
    ...overrides,
  };
}

describe('mapAssetPickerItem', () => {
  it('maps a known repository id with a matching sampler', () => {
    expect(mapAssetPickerItem(item(), 'sampler2D', CATALOG)).toEqual({
      status: 'picked',
      source: { kind: 'repository', textureId: 'uv-checker-01' },
    });
  });

  it('rejects an unknown repository id', () => {
    expect(
      mapAssetPickerItem(item({ id: 'removed' }), 'sampler2D', CATALOG),
    ).toEqual({ status: 'rejected', reason: 'unsupported-asset' });
  });

  it('rejects a texture whose sampler does not match the uniform', () => {
    expect(
      mapAssetPickerItem(item({ id: 'cube-sky' }), 'sampler2D', CATALOG),
    ).toEqual({ status: 'rejected', reason: 'unsupported-asset' });
  });

  it('rejects items that are not files', () => {
    expect(
      mapAssetPickerItem(item({ type: 'dir' }), 'sampler2D', CATALOG),
    ).toEqual({ status: 'rejected', reason: 'unsupported-asset' });
  });

  it('rejects items from a storage other than the bundled repository', () => {
    expect(
      mapAssetPickerItem(
        item({ storage: 'github' }),
        'sampler2D',
        CATALOG,
      ),
    ).toEqual({ status: 'rejected', reason: 'unsupported-asset' });
  });

  it('never carries a URL into the persisted source', () => {
    const result = mapAssetPickerItem(item(), 'sampler2D', CATALOG);

    expect(result).toEqual({
      status: 'picked',
      source: { kind: 'repository', textureId: 'uv-checker-01' },
    });
    expect(JSON.stringify(result)).not.toContain('http');
  });
});
