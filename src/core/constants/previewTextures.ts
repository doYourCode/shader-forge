import { resolveTextureUrl } from '@/core/assets/assetUrls';
import { createCatalog } from '@/core/assets/catalog';
import { assetLabel } from '@/core/assets/labels';
import type {
  PreviewTexture,
  PreviewTextureFormat,
} from '@/core/models/previewTexture';
import type { SamplerKind } from '@/core/models/userUniform';

/** The sampler is the single authored fact; the format follows from it. */
const FORMAT_BY_SAMPLER: Record<SamplerKind, PreviewTextureFormat> = {
  sampler2D: 'image',
  samplerCube: 'cubemap',
};

/** Authored record: the filesystem path is the only source of the URL. */
interface PreviewTextureRecord {
  readonly id: string;
  /** Repo-relative path under `src/assets`. */
  readonly path: string;
  readonly sampler: SamplerKind;
}

/**
 * Repository textures available to user-data sampler uniforms.
 *
 * Adding another image means dropping it under `src/assets/textures`, adding
 * one record here, and adding one `assets.textures.<id>` key per locale. Cube
 * entries must not reuse the HDRI environment assets; they belong here.
 */
const records: readonly PreviewTextureRecord[] = [
  {
    id: 'uv-checker-01',
    path: 'textures/Uv_checker_01.png',
    sampler: 'sampler2D',
  },
  {
    id: 'uv-checker-02',
    path: 'textures/Uv_checker_02.png',
    sampler: 'sampler2D',
  },
];

const entries: readonly PreviewTexture[] = records.map((record) => ({
  id: record.id,
  label: assetLabel('textures', record.id),
  url: resolveTextureUrl(record.path),
  sampler: record.sampler,
  format: FORMAT_BY_SAMPLER[record.sampler],
}));

/**
 * Frozen catalog backing the port below. Textures declare no default: the
 * picker always asks the user for a selection.
 */
const catalog = createCatalog('previewTextures', entries);

/** Every bundled texture, in authored order. */
export const previewTextures: readonly PreviewTexture[] = catalog.all;

export function findPreviewTexture(id: string): PreviewTexture | undefined {
  return catalog.find(id);
}

/** Catalog entries that a uniform of `sampler` kind can bind. */
export function previewTexturesFor(
  sampler: SamplerKind,
): readonly PreviewTexture[] {
  return catalog.by((texture) => texture.sampler === sampler);
}

/**
 * Read-only catalog port over the bundled repository textures. Consumers such
 * as the texture picker depend on this shape rather than on the module-level
 * array, so the source of entries can change without touching them.
 */
export interface TextureCatalog {
  find(id: string): PreviewTexture | undefined;
  forSampler(sampler: SamplerKind): readonly PreviewTexture[];
}

export const previewTextureCatalog: TextureCatalog = {
  find: findPreviewTexture,
  forSampler: previewTexturesFor,
};
