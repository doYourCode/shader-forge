import type {
  AssetPickerAdapter,
  AssetPickerAdapterContext,
  AssetPickerApi,
  AssetPickerItem,
  AssetPickerItemInput,
  AssetPickerListResult,
  AssetPickerStorage,
} from 'assetpicker';

import type {
  ShaderExample,
  ShaderExampleCatalog,
  ShaderExampleGroup,
} from '@/core/constants/shaderExamples';

import { EXAMPLE_ADAPTER_ID } from './examplePickerConfig';

const EMPTY_RESULT: AssetPickerListResult = { items: [], total: 0 };

/**
 * Registers the bundled-example adapter with an already loaded AssetPicker
 * module. The catalog is injected, so the projection is independent from the
 * concrete `shaderExamples` module and from AssetPicker itself.
 */
export function registerExampleAdapter(
  api: AssetPickerApi,
  catalog: ShaderExampleCatalog,
): void {
  api.registerAdapter(EXAMPLE_ADAPTER_ID, (storage, context) =>
    createExampleAdapter(storage, context, catalog, api.createItem),
  );
}

/**
 * Projects the flat example catalog onto AssetPicker's hierarchical adapter
 * contract: the storage root lists one folder per group, and a folder lists
 * its examples. Search deliberately spans every group, because AssetPicker
 * renders search results as a flat list.
 */
function createExampleAdapter(
  storage: AssetPickerStorage,
  context: AssetPickerAdapterContext,
  catalog: ShaderExampleCatalog,
  createItem: AssetPickerApi['createItem'],
): AssetPickerAdapter {
  function listExamples(
    examples: readonly ShaderExample[],
  ): AssetPickerListResult {
    const items = examples.map((example) =>
      toExampleItem(example, storage.key, context, createItem),
    );

    return { items, total: items.length };
  }

  function listGroups(): AssetPickerListResult {
    const items = catalog.groups.map((group) =>
      createItem(
        {
          id: group.id,
          storage: storage.key,
          name: group.label,
          type: 'dir',
          data: { groupId: group.id },
        },
        context.thumbnails,
      ),
    );

    return { items, total: items.length };
  }

  return {
    key: storage.key,
    label: storage.label,
    async list(item: AssetPickerItem | null): Promise<AssetPickerListResult> {
      if (item === null) return listGroups();

      const group = groupOf(item, catalog);
      return group ? listExamples(group.examples) : EMPTY_RESULT;
    },
    async search(word: string): Promise<AssetPickerListResult> {
      const term = word.trim().toLowerCase();
      const matches = catalog.all.filter(
        (example) =>
          term.length === 0 ||
          example.id.toLowerCase().includes(term) ||
          example.label.toLowerCase().includes(term),
      );

      return listExamples(matches);
    },
  };
}

function toExampleItem(
  example: ShaderExample,
  storageId: string,
  context: AssetPickerAdapterContext,
  createItem: AssetPickerApi['createItem'],
): AssetPickerItem {
  const data: AssetPickerItemInput = {
    id: example.id,
    storage: storageId,
    name: example.label,
    type: 'file',
    // Shader sources are GLSL fragments; the grid shows this badge when the
    // example has not been baked yet.
    extension: 'frag',
    thumbnail: example.thumbnailUrl,
    data: { exampleId: example.id },
  };

  return createItem(data, context.thumbnails);
}

/** Reads the group id this adapter stored on a folder item. */
function groupOf(
  item: AssetPickerItem,
  catalog: ShaderExampleCatalog,
): ShaderExampleGroup | undefined {
  const data: unknown = item.data;
  if (typeof data !== 'object' || data === null) return undefined;

  const groupId = (data as { readonly groupId?: unknown }).groupId;
  if (typeof groupId !== 'string') return undefined;

  return catalog.groups.find((group) => group.id === groupId);
}
