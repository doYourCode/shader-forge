import {
  resolveMeshUrl,
  resolveModelThumbnailUrl,
} from '@/core/assets/assetUrls';
import { createCatalog, withDefault } from '@/core/assets/catalog';
import type { DefaultedCatalog } from '@/core/assets/catalog';
import { assetLabel } from '@/core/assets/labels';
import type { PreviewModel } from '@/core/models/previewModel';

/** Authored record: the filesystem path is the only source of the URL. */
interface PreviewModelRecord {
  readonly id: string;
  /** Repo-relative path under `src/assets`. */
  readonly path: string;
  /** Repo-relative path of the square preview under `src/assets`. */
  readonly thumbnailPath: string;
}

/**
 * Adding a model means dropping a GLB under `src/assets/meshes`, adding a
 * square preview under `src/assets/meshes/thumbs`, adding one record here, and
 * adding one `assets.models.<id>` key per locale. The resolver fails at module
 * load if the file or label is missing.
 */
const records: readonly PreviewModelRecord[] = [
  {
    id: 'monkey',
    path: 'meshes/monkey.glb',
    thumbnailPath: 'meshes/thumbs/monkey.png',
  },
  {
    id: 'sphere',
    path: 'meshes/sphere.glb',
    thumbnailPath: 'meshes/thumbs/sphere.png',
  },
  {
    id: 'cube',
    path: 'meshes/Cube.glb',
    thumbnailPath: 'meshes/thumbs/cube.png',
  },
  {
    id: 'bunny',
    path: 'meshes/Bunny.glb',
    thumbnailPath: 'meshes/thumbs/bunny.png',
  },
  {
    id: 'dragon',
    path: 'meshes/Dragon.glb',
    thumbnailPath: 'meshes/thumbs/dragon.png',
  },
];

const entries: readonly PreviewModel[] = records.map((record) => ({
  id: record.id,
  label: assetLabel('models', record.id),
  url: resolveMeshUrl(record.path),
  thumbnailUrl: resolveModelThumbnailUrl(record.thumbnailPath),
}));

/** Viewer models; `default` is the explicitly declared `model` role. */
export const previewModels: DefaultedCatalog<PreviewModel> = withDefault(
  'previewModels',
  createCatalog('previewModels', entries, { model: 'monkey' }),
);

export function findPreviewModel(id: string): PreviewModel | undefined {
  return previewModels.find(id);
}
