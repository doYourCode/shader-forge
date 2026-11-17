/**
 * Build-time URLs for every bundled asset kind.
 *
 * The filesystem is the authority for what exists: these eager globs are the
 * only list of bundled files, and a catalog record that names a missing path
 * throws instead of producing an empty URL that would fail later as a 404.
 *
 * `?url` must stay at build time. Vite fingerprints emitted filenames and
 * prefixes them with the deployment base, so a URL computed at runtime from a
 * guessed path would break in production even though it works in dev.
 *
 * `&no-inline` keeps every catalog asset as a real emitted file. Without it,
 * assets below Vite's inline limit (e.g. the 2 KB `Cube.glb`) become data URLs
 * and disappear from `dist/assets`, breaking the one-to-one audit between the
 * catalog and the built files.
 */

const ASSET_ROOT = '/src/assets';

const MESH_URLS = import.meta.glob('/src/assets/meshes/*.glb', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
}) as Readonly<Record<string, string>>;

const ENVIRONMENT_URLS = import.meta.glob('/src/assets/hdri/env/*.env', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
}) as Readonly<Record<string, string>>;

const TEXTURE_URLS = import.meta.glob(
  '/src/assets/textures/*.{png,jpg,jpeg,webp}',
  {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  },
) as Readonly<Record<string, string>>;

const TEXTURE_THUMBNAIL_URLS = import.meta.glob(
  '/src/assets/textures/thumbs/*.webp',
  {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  },
) as Readonly<Record<string, string>>;

const EXAMPLE_THUMBNAIL_URLS = import.meta.glob(
  '/src/assets/examples/thumbs/*.webp',
  {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  },
) as Readonly<Record<string, string>>;

/**
 * The resolved maps, exposed so catalog invariant tests can compare both
 * directions without restating glob patterns (a test that duplicates the
 * pattern cannot catch a drifted pattern).
 */
export const assetUrlMaps = Object.freeze({
  meshes: Object.freeze(MESH_URLS),
  environments: Object.freeze(ENVIRONMENT_URLS),
  textures: Object.freeze(TEXTURE_URLS),
  textureThumbnails: Object.freeze(TEXTURE_THUMBNAIL_URLS),
  exampleThumbnails: Object.freeze(EXAMPLE_THUMBNAIL_URLS),
});

/** Resolves a mesh path such as `meshes/monkey.glb`. */
export function resolveMeshUrl(path: string): string {
  return resolveAssetUrl(MESH_URLS, path);
}

/** Resolves a baked environment path such as `hdri/env/wooden-studio-17.env`. */
export function resolveEnvUrl(path: string): string {
  return resolveAssetUrl(ENVIRONMENT_URLS, path);
}

/** Resolves a texture path such as `textures/Uv_checker_01.png`. */
export function resolveTextureUrl(path: string): string {
  return resolveAssetUrl(TEXTURE_URLS, path);
}

/** Resolves a thumbnail path such as `textures/thumbs/Uv_checker_01.webp`. */
export function resolveTextureThumbnailUrl(path: string): string {
  return resolveAssetUrl(TEXTURE_THUMBNAIL_URLS, path);
}

/**
 * Resolves an example preview such as `examples/thumbs/phong.webp`.
 *
 * Example thumbnails are baked on demand (`npm run bake:examples`), so a
 * missing file is a legitimate state: the picker falls back to the item's
 * extension badge. Texture thumbnails stay strict because every texture
 * record already ships its own preview.
 */
export function resolveExampleThumbnailUrl(path: string): string | undefined {
  const key = `${ASSET_ROOT}/${path}`;
  if (!Object.hasOwn(EXAMPLE_THUMBNAIL_URLS, key)) return undefined;

  const url = EXAMPLE_THUMBNAIL_URLS[key];
  return url.length > 0 ? url : undefined;
}

/**
 * Resolves a repo-relative `src/assets` path against an eager URL map.
 *
 * Exported so the bake-only `.hdr` resolver can share the same validation and
 * error shape without importing the panoramas into the application graph.
 */
export function resolveAssetUrl(
  urls: Readonly<Record<string, string>>,
  path: string,
): string {
  const key = `${ASSET_ROOT}/${path}`;

  if (!Object.hasOwn(urls, key)) {
    throw new Error(
      `No bundled asset at "${path}" (looked for "${key}"). ` +
        `Nearest available keys: ${nearestKeys(Object.keys(urls), key)}.`,
    );
  }

  const url = urls[key];
  if (url.length === 0) {
    throw new Error(`Bundled asset "${path}" resolved to an empty URL.`);
  }

  return url;
}

/** Three keys sharing the longest prefix, so the error suggests the fix. */
function nearestKeys(keys: readonly string[], missing: string): string {
  if (keys.length === 0) return '(none)';

  return [...keys]
    .sort(
      (left, right) =>
        commonPrefixLength(right, missing) -
          commonPrefixLength(left, missing) || left.localeCompare(right),
    )
    .slice(0, 3)
    .join(', ');
}

function commonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;

  while (index < limit && left.charCodeAt(index) === right.charCodeAt(index)) {
    index += 1;
  }

  return index;
}
