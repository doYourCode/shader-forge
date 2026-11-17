import { describe, expect, it, vi } from 'vitest';
import type {
  AssetPickerAdapter,
  AssetPickerAdapterContext,
  AssetPickerAdapterFactory,
  AssetPickerApi,
  AssetPickerItem,
  AssetPickerItemInput,
  AssetPickerStorage,
  AssetPickerThumbnailMode,
} from 'assetpicker';

import type {
  ShaderExample,
  ShaderExampleCatalog,
} from '@/core/constants/shaderExamples';

import { registerExampleAdapter } from './exampleAdapter';
import { EXAMPLE_ADAPTER_ID, EXAMPLE_STORAGE_ID } from './examplePickerConfig';

function example(
  id: string,
  group: string,
  extra: Partial<ShaderExample> = {},
): ShaderExample {
  return {
    id,
    label: id,
    description: `${id} description`,
    group,
    vertex: '',
    fragment: '',
    uniforms: [],
    ...extra,
  };
}

const PHONG = example('phong', 'Lighting', { label: 'Phong' });
const LAMBERT = example('lambert', 'Lighting', { label: 'Lambert' });
const IBL = example('ibl-metalness-roughness', 'Image-based lighting', {
  label: 'IBL Metalness',
  thumbnailUrl: 'https://cdn.test/ibl-metalness-roughness.webp',
});
const EXAMPLES = [PHONG, LAMBERT, IBL];

const CATALOG: ShaderExampleCatalog = {
  all: EXAMPLES,
  groups: [
    { id: 'lighting', label: 'Lighting', examples: [PHONG, LAMBERT] },
    {
      id: 'image-based-lighting',
      label: 'Image-based lighting',
      examples: [IBL],
    },
  ],
  find: (id) => EXAMPLES.find((entry) => entry.id === id),
};

function createFakeApi() {
  const factories: Record<string, AssetPickerAdapterFactory> = {};

  const createItem = vi.fn(
    (
      data: AssetPickerItemInput,
      _thumbnailMode?: AssetPickerThumbnailMode,
    ): AssetPickerItem => data as unknown as AssetPickerItem,
  );

  const registerAdapter = vi.fn(
    (type: string, factory: AssetPickerAdapterFactory): void => {
      factories[type] = factory;
    },
  );

  const api: AssetPickerApi = {
    createAssetPickerApp: vi.fn(),
    registerAdapter,
    createItem,
  };

  return { api, factories, createItem, registerAdapter };
}

function createAdapter(): {
  adapter: AssetPickerAdapter;
  fake: ReturnType<typeof createFakeApi>;
  context: AssetPickerAdapterContext;
} {
  const fake = createFakeApi();
  registerExampleAdapter(fake.api, CATALOG);

  const factory = fake.factories[EXAMPLE_ADAPTER_ID];
  if (!factory) throw new Error('example adapter was not registered');

  const context: AssetPickerAdapterContext = {
    thumbnails: 'url',
    config: { storages: {} },
  };
  const storage: AssetPickerStorage = {
    key: EXAMPLE_STORAGE_ID,
    adapter: EXAMPLE_ADAPTER_ID,
    label: 'Shader examples',
  };

  return { adapter: factory(storage, context), fake, context };
}

describe('registerExampleAdapter', () => {
  it('registers under the bundled-examples adapter id', () => {
    const fake = createFakeApi();

    registerExampleAdapter(fake.api, CATALOG);

    expect(fake.registerAdapter).toHaveBeenCalledTimes(1);
    expect(fake.registerAdapter.mock.calls[0]?.[0]).toBe(EXAMPLE_ADAPTER_ID);
  });
});

describe('example adapter', () => {
  it('lists one folder per group at the storage root', async () => {
    const { adapter } = createAdapter();

    const root = await adapter.list(null);

    expect(root.total).toBe(2);
    expect(root.items.map((item) => item.name)).toEqual([
      'Lighting',
      'Image-based lighting',
    ]);
    expect(root.items.every((item) => item.type === 'dir')).toBe(true);
    expect(root.items[0]?.storage).toBe(EXAMPLE_STORAGE_ID);
    expect(root.items[0]?.data).toEqual({ groupId: 'lighting' });
  });

  it('lists a group’s examples as pickable files', async () => {
    const { adapter } = createAdapter();

    const root = await adapter.list(null);
    const lighting = root.items.find((item) => item.id === 'lighting');
    if (!lighting) throw new Error('missing lighting folder');

    const listed = await adapter.list(lighting);

    expect(listed.items.map((item) => item.id)).toEqual(['phong', 'lambert']);
    expect(listed.items.every((item) => item.type === 'file')).toBe(true);
    expect(listed.items[0]?.extension).toBe('frag');
    expect(listed.items[0]?.data).toEqual({ exampleId: 'phong' });
    expect(listed.items[1]?.thumbnail).toBeUndefined();
    expect(listed.items).toHaveLength(2);
  });

  it('passes the baked thumbnail through to the item', async () => {
    const { adapter } = createAdapter();

    const root = await adapter.list(null);
    const ibl = root.items.find((item) => item.id === 'image-based-lighting');
    if (!ibl) throw new Error('missing IBL folder');

    const listed = await adapter.list(ibl);

    expect(listed.items[0]?.thumbnail).toBe(
      'https://cdn.test/ibl-metalness-roughness.webp',
    );
  });

  it('returns nothing for a folder it did not create', async () => {
    const { adapter } = createAdapter();

    const unknown: AssetPickerItem = {
      id: 'elsewhere',
      storage: EXAMPLE_STORAGE_ID,
      name: 'Elsewhere',
      type: 'dir',
      data: { groupId: 'removed-group' },
    };

    await expect(adapter.list(unknown)).resolves.toEqual({
      items: [],
      total: 0,
    });
  });

  it('searches every group by id and label', async () => {
    const { adapter } = createAdapter();

    await expect(adapter.search('lam')).resolves.toMatchObject({
      total: 1,
      items: [{ id: 'lambert' }],
    });

    await expect(adapter.search('IBL')).resolves.toMatchObject({
      total: 1,
      items: [{ id: 'ibl-metalness-roughness' }],
    });

    await expect(adapter.search('')).resolves.toMatchObject({ total: 3 });
    await expect(adapter.search('nope')).resolves.toEqual({
      items: [],
      total: 0,
    });
  });

  it('creates every item with the requested thumbnail mode', async () => {
    const { adapter, fake } = createAdapter();

    await adapter.list(null);
    await adapter.search('phong');

    expect(fake.createItem).toHaveBeenCalled();
    expect(fake.createItem.mock.calls.every((call) => call[1] === 'url')).toBe(
      true,
    );
  });
});
