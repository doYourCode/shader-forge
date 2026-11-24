import type { PreviewTexture } from '@/core/models/previewTexture';
import type { SamplerKind, UserTextureSource } from '@/core/models/userUniform';

/**
 * Platform-neutral texture-source contracts.
 *
 * The user-data controller only needs to know that a source can be loaded and
 * released; the pixel representation is owned by the platform adapter (Babylon
 * `BaseTexture`, WebGL `WebGLTexture`). Keeping these types here lets the
 * controller and the sandbox registry compile without importing Babylon.
 */

/** Resolves a repository texture id to its bundled catalog entry. */
export type TextureLookup = (textureId: string) => PreviewTexture | undefined;

/** ObjectURL lifecycle, injectable so tests never touch the real browser API. */
export interface ObjectUrlProvider {
  createObjectUrl(file: File): string;
  revokeObjectUrl(url: string): void;
}

export const browserObjectUrls: ObjectUrlProvider = {
  createObjectUrl: (file) => URL.createObjectURL(file),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
};

/** The slice of a texture registry the uniform controller depends on. */
export interface TextureRegistryPort<TTexture> {
  /** Loads (or replaces) the texture registered under `definitionId`. */
  load(
    definitionId: string,
    kind: SamplerKind,
    source: UserTextureSource,
  ): Promise<TTexture | null>;
  /** Disposes the texture for a removed or re-kinded definition. */
  release(definitionId: string): void;
  /** The texture currently registered for a definition, if it is loaded. */
  textureFor(definitionId: string): TTexture | null;
  dispose(): void;
}

/** A source that has been resolved to a loadable URL. */
export interface ResolvedTextureSource {
  readonly url: string;
  /** Set only for uploaded files, whose URL the caller must revoke. */
  readonly objectUrl: string | null;
}

/**
 * Resolves the three authored source shapes to a URL.
 *
 * `null` means the source cannot be loaded: an unknown catalog entry, a
 * repository texture whose sampler does not match the uniform, or an empty
 * URL. Callers decide whether to release the previously loaded texture.
 */
export function resolveTextureSource(
  source: UserTextureSource,
  kind: SamplerKind,
  lookup: TextureLookup,
  objectUrls: ObjectUrlProvider,
): ResolvedTextureSource | null {
  if (source.kind === 'file') {
    const url = objectUrls.createObjectUrl(source.file);
    return { url, objectUrl: url };
  }

  if (source.kind === 'repository') {
    const entry = lookup(source.textureId);
    if (!entry || entry.sampler !== kind) return null;
    return { url: entry.url, objectUrl: null };
  }

  const url = source.url.trim();
  return url.length > 0 ? { url, objectUrl: null } : null;
}

/** True when two authored sources describe the same texture request. */
export function sameTextureSource(
  previous: UserTextureSource,
  next: UserTextureSource,
): boolean {
  if (previous.kind === 'file' && next.kind === 'file') {
    return previous.file === next.file;
  }

  if (previous.kind === 'url' && next.kind === 'url') {
    return previous.url.trim() === next.url.trim();
  }

  if (previous.kind === 'repository' && next.kind === 'repository') {
    return previous.textureId === next.textureId;
  }

  return false;
}
