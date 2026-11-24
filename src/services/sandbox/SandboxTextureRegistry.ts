import type { SamplerKind, UserTextureSource } from '@/core/models/userUniform';
import { KeyedLatestLoads, type PendingLoad } from '@/core/async/latestLoad';
import {
  browserObjectUrls,
  resolveTextureSource,
  sameTextureSource,
  type ObjectUrlProvider,
  type TextureLookup,
  type TextureRegistryPort,
} from '@/services/userdata/TextureSource';

/** Loads a URL into something `texImage2D` accepts. */
export type SandboxImageLoader = (url: string) => Promise<TexImageSource>;

export interface SandboxTextureRegistryOptions {
  readonly objectUrls?: ObjectUrlProvider;
  readonly loadImage?: SandboxImageLoader;
  /** Fired after a texture becomes current, so a paused preview can redraw. */
  readonly onTextureReady?: () => void;
}

interface LoadedTexture {
  readonly source: UserTextureSource;
  readonly texture: WebGLTexture;
  readonly objectUrl: string | null;
}

interface PendingTexture {
  readonly source: UserTextureSource;
  texture: WebGLTexture | null;
  objectUrl: string | null;
}

/**
 * Owns the WebGL textures backing user sampler uniforms.
 *
 * It mirrors the Babylon registry's contract: the current texture stays bound
 * until its replacement has loaded, a newer request for a definition retires
 * the previous one, retired textures are disposed exactly once, and uploaded
 * files' ObjectURLs are revoked here.
 *
 * The sandbox only supports `sampler2D`; the UI does not offer `samplerCube`,
 * so a cube kind is rejected defensively instead of pretending to load one.
 */
export class SandboxTextureRegistry implements TextureRegistryPort<WebGLTexture> {
  private readonly gl: WebGL2RenderingContext;
  private readonly lookup: TextureLookup;
  private readonly objectUrls: ObjectUrlProvider;
  private readonly loadImage: SandboxImageLoader;
  private readonly onTextureReady: () => void;
  private readonly current = new Map<string, LoadedTexture>();
  private readonly pending = new KeyedLatestLoads<
    string,
    WebGLTexture | null,
    PendingTexture
  >(null);
  private disposed = false;

  constructor(
    gl: WebGL2RenderingContext,
    lookup: TextureLookup,
    options: SandboxTextureRegistryOptions = {},
  ) {
    this.gl = gl;
    this.lookup = lookup;
    this.objectUrls = options.objectUrls ?? browserObjectUrls;
    this.loadImage = options.loadImage ?? loadImageElement;
    this.onTextureReady = options.onTextureReady ?? (() => {});
  }

  load(
    definitionId: string,
    kind: SamplerKind,
    source: UserTextureSource,
  ): Promise<WebGLTexture | null> {
    if (this.disposed) return Promise.resolve(null);

    if (kind !== 'sampler2D') {
      this.release(definitionId);
      return Promise.resolve(null);
    }

    const loaded = this.current.get(definitionId);
    if (loaded && sameTextureSource(loaded.source, source)) {
      return Promise.resolve(loaded.texture);
    }

    const inFlight = this.pending.get(definitionId);
    if (inFlight && sameTextureSource(inFlight.payload.source, source)) {
      return inFlight.promise;
    }

    const resolved = resolveTextureSource(
      source,
      kind,
      this.lookup,
      this.objectUrls,
    );

    if (!resolved) {
      this.release(definitionId);
      return Promise.resolve(null);
    }

    const entry: PendingTexture = {
      source,
      texture: null,
      objectUrl: resolved.objectUrl,
    };
    const load = this.pending.begin(definitionId, entry, (pending) =>
      this.disposeEntry(pending),
    );

    void this.uploadWhenReady(definitionId, load, resolved.url);
    return load.promise;
  }

  release(definitionId: string): void {
    this.pending.cancel(definitionId);
    this.disposeCurrent(definitionId);
  }

  textureFor(definitionId: string): WebGLTexture | null {
    return this.current.get(definitionId)?.texture ?? null;
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.pending.dispose();

    for (const loaded of this.current.values()) {
      this.disposeLoaded(loaded);
    }
    this.current.clear();
  }

  private async uploadWhenReady(
    definitionId: string,
    load: PendingLoad<WebGLTexture | null, PendingTexture>,
    url: string,
  ): Promise<void> {
    try {
      const image = await this.loadImage(url);
      if (this.disposed || !load.isCurrent()) return;

      const texture = this.createTexture(image);
      if (!texture) {
        this.finishError(load);
        return;
      }

      if (this.disposed || !load.isCurrent()) {
        this.gl.deleteTexture(texture);
        return;
      }

      load.payload.texture = texture;
      this.finishLoad(definitionId, load);
    } catch {
      this.finishError(load);
    }
  }

  private createTexture(image: TexImageSource): WebGLTexture | null {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) return null;

    // Uploading must not clobber a sampler's live binding on the current
    // texture unit. Save the active unit and unit 0's binding, upload there,
    // then restore both states.
    const previousUnit = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
    gl.activeTexture(gl.TEXTURE0);
    const previousTexture = gl.getParameter(
      gl.TEXTURE_BINDING_2D,
    ) as WebGLTexture | null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    gl.activeTexture(previousUnit);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    return texture;
  }

  private finishLoad(
    definitionId: string,
    load: PendingLoad<WebGLTexture | null, PendingTexture>,
  ): void {
    if (this.disposed || !load.isCurrent()) return;

    const entry = load.payload;
    const texture = entry.texture;
    if (!texture) {
      this.finishError(load);
      return;
    }

    this.disposeCurrent(definitionId);
    this.current.set(definitionId, {
      source: entry.source,
      texture,
      objectUrl: entry.objectUrl,
    });
    // Ownership moved to `current`; a late retirement must not release it.
    entry.texture = null;
    entry.objectUrl = null;
    load.settle(texture);
    // The controller binds the texture in the promise reaction `settle` just
    // queued. Notify after that reaction so a paused preview redraws with the
    // texture already bound, not one frame before it.
    queueMicrotask(() => {
      if (!this.disposed) this.onTextureReady();
    });
  }

  private finishError(
    load: PendingLoad<WebGLTexture | null, PendingTexture>,
  ): void {
    if (load.isCurrent()) load.settle(null);
  }

  private disposeCurrent(definitionId: string): void {
    const loaded = this.current.get(definitionId);
    if (!loaded) return;

    this.current.delete(definitionId);
    this.disposeLoaded(loaded);
  }

  private disposeLoaded(loaded: LoadedTexture): void {
    this.gl.deleteTexture(loaded.texture);
    if (loaded.objectUrl !== null) {
      this.objectUrls.revokeObjectUrl(loaded.objectUrl);
    }
  }

  private disposeEntry(entry: PendingTexture): void {
    if (entry.texture) {
      this.gl.deleteTexture(entry.texture);
      entry.texture = null;
    }

    if (entry.objectUrl !== null) {
      this.objectUrls.revokeObjectUrl(entry.objectUrl);
      entry.objectUrl = null;
    }
  }
}

function loadImageElement(url: string): Promise<TexImageSource> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load texture: ${url}`));
    image.src = url;
  });
}
