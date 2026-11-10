import type { AssetPickerItem } from 'assetpicker';

import type { TextureCatalog } from '@/core/constants/previewTextures';
import type { SamplerKind } from '@/core/models/userUniform';
import type { TexturePickResult } from '@/services/texturepicker/TexturePicker';

import { REPOSITORY_STORAGE_ID } from './assetPickerConfig';

const REJECTED: TexturePickResult = {
  status: 'rejected',
  reason: 'unsupported-asset',
};

/**
 * Anti-corruption layer between AssetPicker's item shape and the domain's
 * `UserTextureSource`. Only repository ids are mapped: a remote URL would
 * bypass the stable-id invariant, so it is rejected rather than converted.
 */
export function mapAssetPickerItem(
  item: AssetPickerItem,
  sampler: SamplerKind,
  catalog: TextureCatalog,
): TexturePickResult {
  if (item.type !== 'file') return REJECTED;
  if (item.storage !== REPOSITORY_STORAGE_ID) return REJECTED;

  const texture = catalog.find(item.id);
  if (!texture || texture.sampler !== sampler) return REJECTED;

  return {
    status: 'picked',
    source: { kind: 'repository', textureId: texture.id },
  };
}
