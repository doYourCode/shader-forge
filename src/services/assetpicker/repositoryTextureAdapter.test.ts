import { describe, expect, it } from 'vitest';
import type {
  AssetPickerAdapter,
  AssetPickerAdapterFactory,
  AssetPickerApi,
  AssetPickerItem,
  AssetPickerItemInput,
  AssetPickerThumbnailMode,
} from 'assetpicker';

import type { TextureCatalog } from '@/core/constants/previewTextures';
import type { PreviewTexture } from '@/core/models/previewTexture';
import type { SamplerKind } from '@/core/models/userUniform';

import { REPOSITORY_ADAPTER_ID, REPOSITORY_STORAGE_ID } from './assetPickerConfig';
import { registerRepositoryAdapter } from './repositoryTextureAdapter';

const CHECKER: PreviewTexture = {
  id: 'uv-checker-01',
  label: 'UV Checker 01',
  url: 'https://cdn.example/textures/uv-checker-01.png?v=2#preview',
  sampler: 'sampler2D',
  format: 'image',
};

const MARBLE: PreviewTexture = {
  id: 'marble',
  label: 'Marble Tiles',
  url: 'https://cdn.example/textures/Marble.JPEG?size=large',
  sampler: 'sampler2D',
  format: 'image',
};

const CUBE: PreviewTexture = {
  id: 'cube-sky',
  label: 'Cube Sky',
  url: 'https://cdn.example/textures/cube-sky.png',
  sampler: 'samplerCube',
  format: 'cubemap',
};

const ENTRIES: readonly PreviewTexture[] = [CHECKER, MARBLE, CUBE];

function createCatalog(entries: readonly PreviewTexture[]): TextureCatalog {
  return {
    find: (id) => entries.find((texture) => texture.id === id),
    forSampler: (sampler) =>
      entries.filter((texture) => texture.sampler === sampler),
  };
}

function createFakeApi() {
  const registrations: Array<{
    type: string;
    factory: AssetPickerAdapterFactory;
  }> = [];
  const itemCalls: Array<{
    input: AssetPickerItemInput;
    thumbnails?: AssetPickerThumbnailMode;
  }> = [];

  const createItem = (
    data: AssetPickerItemInput | (() => AssetPickerItemInput),
    thumbnails?: AssetPickerThumbnailMode,
  ): AssetPickerItem => {
    const input = typeof data === 'function' ? data() : data;
    itemCalls.push({ input, thumbnails });
    return { ...input };
  };

  const registerAdapter = (
    type: string,
    factory: AssetPickerAdapterFactory,
  ): void => {
    registrations.push({ type, factory });
  };

  const api: AssetPickerApi = {
    createAssetPickerApp: () => {
      throw new Error('not used by this test');
    },
    registerAdapter,
    createItem,
  };

  return { api, registrations, itemCalls };
}

function createAdapter(
  entries: readonly PreviewTexture[] = ENTRIES,
  sampler: SamplerKind = 'sampler2D',
) {
  const fake = createFakeApi();
  registerRepositoryAdapter(fake.api, createCatalog(entries));

  const registration = fake.registrations[0];
  if (!registration) throw new Error('adapter was not registered');

  const adapter: AssetPickerAdapter = registration.factory(
    {
      key: REPOSITORY_STORAGE_ID,
      adapter: REPOSITORY_ADAPTER_ID,
      label: 'Bundled textures',
      sampler,
    },
    { thumbnails: 'url', config: { storages: {} } },
  );

  return { adapter, ...fake };
}

describe('registerRepositoryAdapter', () => {
  it('registers the bundled-textures adapter', () => {
    const fake = createFakeApi();

    registerRepositoryAdapter(fake.api, createCatalog(ENTRIES));

    expect(fake.registrations).toHaveLength(1);
    expect(fake.registrations[0]?.type).toBe(REPOSITORY_ADAPTER_ID);
  });

  it('lists only the textures matching the storage sampler', async () => {
    const { adapter } = createAdapter();

    const result = await adapter.list(null);

    expect(result.items.map((item) => item.id)).toEqual([
      'uv-checker-01',
      'marble',
    ]);
    expect(result.total).toBe(2);
  });

  it('maps a catalog entry to an AssetPicker item', async () => {
    const { adapter } = createAdapter();

    const result = await adapter.list(null);
    const item = result.items[0];

    expect(item).toMatchObject({
      id: CHECKER.id,
      storage: REPOSITORY_STORAGE_ID,
      name: CHECKER.label,
      type: 'file',
      extension: 'png',
      thumbnail: CHECKER.url,
      links: { open: CHECKER.url },
      data: { textureId: CHECKER.id },
    });
  });

  it('strips query strings and hashes before deriving the extension', async () => {
    const { adapter } = createAdapter();

    const result = await adapter.list(null);

    expect(result.items[1]?.extension).toBe('jpeg');
  });

  it('passes the requested thumbnail mode to createItem', async () => {
    const { adapter, itemCalls } = createAdapter();

    await adapter.list(null);

    expect(itemCalls.length).toBeGreaterThan(0);
    expect(itemCalls.every((call) => call.thumbnails === 'url')).toBe(true);
  });

  it('returns nothing for a folder because the catalog is flat', async () => {
    const { adapter } = createAdapter();
    const folder: AssetPickerItem = {
      id: 'folder',
      storage: REPOSITORY_STORAGE_ID,
      name: 'Folder',
      type: 'dir',
    };

    expect(await adapter.list(folder)).toEqual({ items: [], total: 0 });
  });

  it('filters search results by id and label, case-insensitively', async () => {
    const { adapter } = createAdapter();

    const byId = await adapter.search('UV-CHECKER');
    expect(byId.items.map((item) => item.id)).toEqual(['uv-checker-01']);

    const byLabel = await adapter.search('marble');
    expect(byLabel.items.map((item) => item.id)).toEqual(['marble']);
    expect(byLabel.total).toBe(1);

    const byPartialLabel = await adapter.search('tiles');
    expect(byPartialLabel.items.map((item) => item.id)).toEqual(['marble']);
  });

  it('returns an empty result when search matches nothing', async () => {
    const { adapter } = createAdapter();

    expect(await adapter.search('nothing-here')).toEqual({
      items: [],
      total: 0,
    });
  });

  it('returns an empty list for an empty catalog', async () => {
    const { adapter } = createAdapter([]);

    expect(await adapter.list(null)).toEqual({ items: [], total: 0 });
    expect(await adapter.search('checker')).toEqual({ items: [], total: 0 });
  });
});
