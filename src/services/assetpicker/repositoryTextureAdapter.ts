import type {
  AssetPickerAdapter,
  AssetPickerAdapterContext,
  AssetPickerApi,
  AssetPickerItem,
  AssetPickerItemInput,
  AssetPickerListResult,
  AssetPickerStorage,
} from 'assetpicker';

import type { TextureCatalog } from '@/core/constants/previewTextures';
import type { PreviewTexture } from '@/core/models/previewTexture';
import type { SamplerKind } from '@/core/models/userUniform';

import { REPOSITORY_ADAPTER_ID } from './assetPickerConfig';

const EMPTY_RESULT: AssetPickerListResult = { items: [], total: 0 };

/**
 * Registers the bundled-texture adapter with an already loaded AssetPicker
 * module. The catalog is injected, so the projection is independent from the
 * concrete `previewTextures` module and from AssetPicker itself.
 */
export function registerRepositoryAdapter(
  api: AssetPickerApi,
  catalog: TextureCatalog,
): void {
  api.registerAdapter(REPOSITORY_ADAPTER_ID, (storage, context) =>
    createRepositoryAdapter(storage, context, catalog, api.createItem),
  );
}

/**
 * Projects the flat texture catalog onto AssetPicker's hierarchical adapter
 * contract: the storage root lists one page of files and folders are not part
 * of the catalog model.
 */
function createRepositoryAdapter(
  storage: AssetPickerStorage,
  context: AssetPickerAdapterContext,
  catalog: TextureCatalog,
  createItem: AssetPickerApi['createItem'],
): AssetPickerAdapter {
  const sampler = samplerOf(storage);

  function listTextures(textures: readonly PreviewTexture[]): AssetPickerListResult {
    const items = textures.map((texture) =>
      toAssetPickerItem(texture, storage.key, context, createItem),
    );

    return { items, total: items.length };
  }

  return {
    key: storage.key,
    label: storage.label,
    async list(item: AssetPickerItem | null): Promise<AssetPickerListResult> {
      if (item !== null || sampler === null) return EMPTY_RESULT;

      return listTextures(catalog.forSampler(sampler));
    },
    async search(word: string): Promise<AssetPickerListResult> {
      if (sampler === null) return EMPTY_RESULT;

      const term = word.trim().toLowerCase();
      const textures = catalog
        .forSampler(sampler)
        .filter(
          (texture) =>
            term.length === 0 ||
            texture.id.toLowerCase().includes(term) ||
            texture.label.toLowerCase().includes(term),
        );

      return listTextures(textures);
    },
  };
}

function toAssetPickerItem(
  texture: PreviewTexture,
  storageId: string,
  context: AssetPickerAdapterContext,
  createItem: AssetPickerApi['createItem'],
): AssetPickerItem {
  const data: AssetPickerItemInput = {
    id: texture.id,
    storage: storageId,
    name: texture.label,
    type: 'file',
    extension: extensionOf(texture.url),
    thumbnail: texture.url,
    links: { open: texture.url },
    data: { textureId: texture.id },
  };

  // Thumbnails are URLs; the persisted value is the stable id in `data`, never
  // the thumbnail or links.open build-time URL.
  return createItem(data, context.thumbnails);
}

/** Lower-case extension of a URL path, ignoring query strings and hashes. */
function extensionOf(url: string): string | undefined {
  const withoutQuery = url.split(/[?#]/, 1)[0] ?? '';
  const filename = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return undefined;

  return filename.slice(dot + 1).toLowerCase();
}

function samplerOf(storage: AssetPickerStorage): SamplerKind | null {
  const sampler = storage.sampler;

  return sampler === 'sampler2D' || sampler === 'samplerCube' ? sampler : null;
}
