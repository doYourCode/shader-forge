import checkerUrl from '@/assets/textures/Uv_checker_01.png?url';
import checker2Url from '@/assets/textures/Uv_checker_02.png?url';

import type { PreviewTexture } from '@/core/models/previewTexture';
import type { SamplerKind } from '@/core/models/userUniform';

/**
 * Repository textures available to user-data sampler uniforms. Adding another
 * 2D image (or, later, a cube asset) is a one-line change: import its URL and
 * append an entry here. Cube entries must not reuse the HDRI environment
 * assets; they belong to this catalog instead.
 */
export const previewTextures: readonly PreviewTexture[] = [
  {
    id: 'uv-checker-01',
    label: 'UV Checker 01',
    url: checkerUrl,
    sampler: 'sampler2D',
    format: 'image',
  },
    {
    id: 'uv-checker-02',
    label: 'UV Checker 02',
    url: checker2Url,
    sampler: 'sampler2D',
    format: 'image',
  },
];

export function findPreviewTexture(id: string): PreviewTexture | undefined {
  return previewTextures.find((texture) => texture.id === id);
}

/** Catalog entries that a uniform of `sampler` kind can bind. */
export function previewTexturesFor(
  sampler: SamplerKind,
): readonly PreviewTexture[] {
  return previewTextures.filter((texture) => texture.sampler === sampler);
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
