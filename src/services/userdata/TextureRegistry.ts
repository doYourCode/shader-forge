import {
  CubeTexture,
  Texture,
  type BaseTexture,
  type Scene,
} from '@babylonjs/core';
import { findPreviewTexture } from '@/core/constants/previewTextures';
import type { PreviewTexture } from '@/core/models/previewTexture';
import type {
  SamplerKind,
  UserTextureSource,
} from '@/core/models/userUniform';

/** Creates a Babylon texture and reports its asynchronous load outcome. */
export type UserTextureFactory = (
  scene: Scene,
  kind: SamplerKind,
  url: string,
  onLoad: () => void,
  onError: () => void,
) => BaseTexture;

/** ObjectURL lifecycle, injectable so tests never touch the real browser API. */
export interface ObjectUrlProvider {
  createObjectUrl(file: File): string;
  revokeObjectUrl(url: string): void;
}

/** Resolves a repository texture id to its bundled catalog entry. */
export type TextureLookup = (textureId: string) => PreviewTexture | undefined;

/**
 * Registers a plain 2D texture for `sampler2D` and a cube texture for
 * `samplerCube`. The `kind` is part of the factory so the registry itself
 * stays free of Babylon class knowledge in its tests.
 */
export const createUserTexture: UserTextureFactory = (
  scene,
  kind,
  url,
  onLoad,
  onError,
) => {
  if (kind === 'samplerCube') {
    return new CubeTexture(url, scene, null, false, null, onLoad, onError);
  }

  return new Texture(
    url,
    scene,
    true,
    false,
    Texture.TRILINEAR_SAMPLINGMODE,
    onLoad,
    onError,
  );
};

export const browserObjectUrls: ObjectUrlProvider = {
  createObjectUrl: (file) => URL.createObjectURL(file),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
};

/** The slice of the registry the uniform controller depends on. */
export interface TextureRegistryPort {
  /** Loads (or replaces) the texture registered under `definitionId`. */
  load(
    definitionId: string,
    kind: SamplerKind,
    source: UserTextureSource,
  ): Promise<BaseTexture | null>;
  /** Disposes the texture for a removed or re-kinded definition. */
  release(definitionId: string): void;
  /** The texture currently registered for a definition, if it is loaded. */
  textureFor(definitionId: string): BaseTexture | null;
  dispose(): void;
}

interface LoadedTexture {
  readonly source: UserTextureSource;
  readonly texture: BaseTexture;
  readonly objectUrl: string | null;
}

interface PendingTexture {
  readonly source: UserTextureSource;
  readonly promise: Promise<BaseTexture | null>;
  readonly resolve: (texture: BaseTexture | null) => void;
  texture: BaseTexture | null;
  objectUrl: string | null;
  settled: boolean;
}

/**
 * Owns the BaseTextures backing user texture uniforms.
 *
 * The lifecycle mirrors `EnvironmentController`: the current texture stays
 * bound until its replacement has loaded, a request for a definition replaces
 * any pending request for it (latest request wins), retired textures are
 * disposed exactly once, and the registry is the only owner of the ObjectURLs
 * it created from uploaded files.
 */
export class TextureRegistry implements TextureRegistryPort {
  private readonly scene: Scene;
  private readonly createTexture: UserTextureFactory;
  private readonly objectUrls: ObjectUrlProvider;
  private readonly lookup: TextureLookup;
  private readonly current = new Map<string, LoadedTexture>();
  private readonly pending = new Map<string, PendingTexture>();
  private disposed = false;

  constructor(
    scene: Scene,
    createTexture: UserTextureFactory = createUserTexture,
    objectUrls: ObjectUrlProvider = browserObjectUrls,
    lookup: TextureLookup = findPreviewTexture,
  ) {
    this.scene = scene;
    this.createTexture = createTexture;
    this.objectUrls = objectUrls;
    this.lookup = lookup;
  }

  load(
    definitionId: string,
    kind: SamplerKind,
    source: UserTextureSource,
  ): Promise<BaseTexture | null> {
    if (this.disposed) return Promise.resolve(null);

    const loaded = this.current.get(definitionId);
    if (loaded && sameSource(loaded.source, source)) {
      return Promise.resolve(loaded.texture);
    }

    const inFlight = this.pending.get(definitionId);
    if (inFlight && sameSource(inFlight.source, source)) {
      return inFlight.promise;
    }
    if (inFlight) this.cancelPending(definitionId, inFlight);

    let url: string;
    if (source.kind === 'file') {
      url = this.objectUrls.createObjectUrl(source.file);
    } else if (source.kind === 'repository') {
      const entry = this.lookup(source.textureId);
      if (!entry || entry.sampler !== kind) {
        this.release(definitionId);
        return Promise.resolve(null);
      }
      url = entry.url;
    } else {
      url = source.url.trim();
    }

    if (url.length === 0) {
      this.release(definitionId);
      return Promise.resolve(null);
    }

    let resolveEntry!: (texture: BaseTexture | null) => void;
    const promise = new Promise<BaseTexture | null>((resolve) => {
      resolveEntry = resolve;
    });
    const entry: PendingTexture = {
      source,
      promise,
      resolve: resolveEntry,
      texture: null,
      objectUrl: source.kind === 'file' ? url : null,
      settled: false,
    };
    this.pending.set(definitionId, entry);

    try {
      // `queueMicrotask` keeps the callback contract asynchronous even when a
      // test factory calls back synchronously.
      entry.texture = this.createTexture(
        this.scene,
        kind,
        url,
        () => queueMicrotask(() => this.finishLoad(definitionId, entry)),
        () => queueMicrotask(() => this.finishError(definitionId, entry)),
      );
    } catch {
      this.finishError(definitionId, entry);
    }

    return promise;
  }

  release(definitionId: string): void {
    const inFlight = this.pending.get(definitionId);
    if (inFlight) this.cancelPending(definitionId, inFlight);
    this.disposeCurrent(definitionId);
  }

  textureFor(definitionId: string): BaseTexture | null {
    return this.current.get(definitionId)?.texture ?? null;
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    for (const entry of this.pending.values()) {
      this.disposeEntry(entry);
      this.settle(entry, null);
    }
    this.pending.clear();

    for (const loaded of this.current.values()) {
      this.disposeLoaded(loaded);
    }
    this.current.clear();
  }

  private finishLoad(definitionId: string, entry: PendingTexture): void {
    if (this.disposed || this.pending.get(definitionId) !== entry) {
      // A superseded request must not clobber the newer registration.
      this.disposeEntry(entry);
      this.settle(entry, null);
      return;
    }

    const texture = entry.texture;
    if (!texture) {
      this.finishError(definitionId, entry);
      return;
    }

    this.pending.delete(definitionId);
    this.disposeCurrent(definitionId);
    this.current.set(definitionId, {
      source: entry.source,
      texture,
      objectUrl: entry.objectUrl,
    });
    // Ownership moved to `current`; a late callback must not release it.
    entry.texture = null;
    entry.objectUrl = null;
    this.settle(entry, texture);
  }

  private finishError(definitionId: string, entry: PendingTexture): void {
    if (this.pending.get(definitionId) === entry) {
      this.pending.delete(definitionId);
    }

    this.disposeEntry(entry);
    this.settle(entry, null);
  }

  private cancelPending(definitionId: string, entry: PendingTexture): void {
    if (this.pending.get(definitionId) === entry) {
      this.pending.delete(definitionId);
    }

    this.disposeEntry(entry);
    this.settle(entry, null);
  }

  private disposeCurrent(definitionId: string): void {
    const loaded = this.current.get(definitionId);
    if (!loaded) return;

    this.current.delete(definitionId);
    this.disposeLoaded(loaded);
  }

  private disposeLoaded(loaded: LoadedTexture): void {
    loaded.texture.dispose();
    if (loaded.objectUrl !== null) {
      this.objectUrls.revokeObjectUrl(loaded.objectUrl);
    }
  }

  private disposeEntry(entry: PendingTexture): void {
    entry.texture?.dispose();
    entry.texture = null;

    if (entry.objectUrl !== null) {
      this.objectUrls.revokeObjectUrl(entry.objectUrl);
      entry.objectUrl = null;
    }
  }

  private settle(entry: PendingTexture, texture: BaseTexture | null): void {
    if (entry.settled) return;

    entry.settled = true;
    entry.resolve(texture);
  }
}

function sameSource(
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
