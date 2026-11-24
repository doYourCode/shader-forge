import { resolveSceneUrl } from '@/core/assets/assetUrls';
import { createCatalog, withDefault } from '@/core/assets/catalog';
import type { DefaultedCatalog } from '@/core/assets/catalog';
import { assetLabel } from '@/core/assets/labels';
import type { PreviewScene } from '@/core/models/previewScene';

/** Authored record: the filesystem path is the only source of the URL. */
interface PreviewSceneRecord {
  readonly id: string;
  /** Repo-relative path under `src/assets`. */
  readonly path: string;
}

/**
 * Whole-scene assets for the Screen Space editor. They live outside the model
 * catalog on purpose: a scene is a complete hierarchy with its own materials,
 * lights and draw calls, not a single mesh to be re-shaded.
 */
const records: readonly PreviewSceneRecord[] = [
  {
    id: 'bistro',
    path: 'scenes/bistro_compressed.glb',
  },
];

const entries: readonly PreviewScene[] = records.map((record) => ({
  id: record.id,
  label: assetLabel('scenes', record.id),
  url: resolveSceneUrl(record.path),
}));

/** Screen-space scenes; `default` is the explicitly declared `scene` role. */
export const previewScenes: DefaultedCatalog<PreviewScene> = withDefault(
  'previewScenes',
  createCatalog('previewScenes', entries, { scene: 'bistro' }),
);

export function findPreviewScene(id: string): PreviewScene | undefined {
  return previewScenes.find(id);
}
