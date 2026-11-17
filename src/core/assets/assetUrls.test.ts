import { describe, expect, it } from 'vitest';

import {
  resolveEnvUrl,
  resolveMeshUrl,
  resolveTextureThumbnailUrl,
  resolveTextureUrl,
} from './assetUrls';

const MESHES = import.meta.glob('/src/assets/meshes/*.glb', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ENVIRONMENTS = import.meta.glob('/src/assets/hdri/env/*.env', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const TEXTURES = import.meta.glob(
  '/src/assets/textures/*.{png,jpg,jpeg,webp}',
  {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

const TEXTURE_THUMBNAILS = import.meta.glob(
  '/src/assets/textures/thumbs/*.webp',
  {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

describe('asset URL resolvers', () => {
  it('resolves an existing repo-relative path', () => {
    expect(resolveMeshUrl('meshes/monkey.glb')).toBe(
      MESHES['/src/assets/meshes/monkey.glb'],
    );
    expect(resolveEnvUrl('hdri/env/wooden-studio-17.env')).toBe(
      ENVIRONMENTS['/src/assets/hdri/env/wooden-studio-17.env'],
    );
    expect(resolveTextureUrl('textures/Uv_checker_01.png')).toBe(
      TEXTURES['/src/assets/textures/Uv_checker_01.png'],
    );
    expect(
      resolveTextureThumbnailUrl('textures/thumbs/Uv_checker_01.webp'),
    ).toBe(
      TEXTURE_THUMBNAILS['/src/assets/textures/thumbs/Uv_checker_01.webp'],
    );
  });

  it('can resolve every file the globs expose', () => {
    for (const [key, url] of Object.entries(MESHES)) {
      expect(resolveMeshUrl(pathOf(key))).toBe(url);
    }
    for (const [key, url] of Object.entries(ENVIRONMENTS)) {
      expect(resolveEnvUrl(pathOf(key))).toBe(url);
    }
    for (const [key, url] of Object.entries(TEXTURES)) {
      expect(resolveTextureUrl(pathOf(key))).toBe(url);
    }
    for (const [key, url] of Object.entries(TEXTURE_THUMBNAILS)) {
      expect(resolveTextureThumbnailUrl(pathOf(key))).toBe(url);
    }
  });

  it('throws with the missing path and nearest keys instead of returning ""', () => {
    expect(() => resolveMeshUrl('meshes/monkeyy.glb')).toThrow(
      /meshes\/monkeyy\.glb/,
    );
    expect(() => resolveMeshUrl('meshes/monkeyy.glb')).toThrow(
      /meshes\/monkey\.glb/,
    );
  });

  it('throws for a path outside the scoped kind', () => {
    expect(() => resolveMeshUrl('textures/Uv_checker_01.png')).toThrow(
      /No bundled asset/,
    );
  });
});

function pathOf(key: string): string {
  return key.replace(/^\/src\/assets\//, '');
}
