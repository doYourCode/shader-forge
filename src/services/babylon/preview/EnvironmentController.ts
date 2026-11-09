import {
  BackgroundMaterial,
  CreateBox,
  HDRCubeTexture,
  Texture,
  type BaseTexture,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import type { PreviewHdri } from '@/core/models/previewHdri';
import {
  createNativeEnvironmentIblFilter,
  type EnvironmentIblFilter,
  type EnvironmentIblFilterFactory,
} from './IblFiltering';

/** Face size used when converting the equirectangular HDR panorama. */
const HDR_CUBE_SIZE = 512;
/** Skybox edge length; `infiniteDistance` keeps it around the camera. */
const SKYBOX_SIZE = 1000;

/**
 * Creates an environment texture and reports its asynchronous load outcome.
 * The indirection keeps Babylon out of the controller's tests.
 */
export type EnvironmentTextureFactory = (
  scene: Scene,
  url: string,
  onLoad: () => void,
  onError: () => void,
) => BaseTexture;

/** The project ships RGBE `.hdr` panoramas, so HDRCubeTexture is the format fit. */
export const createHdrEnvironmentTexture: EnvironmentTextureFactory = (
  scene,
  url,
  onLoad,
  onError,
) =>
  new HDRCubeTexture(
    url,
    scene,
    HDR_CUBE_SIZE,
    false,
    true,
    false,
    false,
    onLoad,
    onError,
  );

/** A drawable background that mirrors the active environment texture. */
export interface EnvironmentBackground {
  setTexture(texture: BaseTexture): void;
  dispose(): void;
}

/** Factory indirection so the controller stays testable without Babylon meshes. */
export type EnvironmentBackgroundFactory = (
  scene: Scene,
) => EnvironmentBackground;

/**
 * Draws the environment independently of the model's shader: an unlit skybox
 * with its own BackgroundMaterial. The mesh follows the camera and is excluded
 * from picking, so it does not interfere with the preview model.
 */
export const createHdrEnvironmentBackground: EnvironmentBackgroundFactory = (
  scene,
) => {
  const mesh: Mesh = CreateBox('hdriBackground', { size: SKYBOX_SIZE }, scene);
  const material = new BackgroundMaterial('hdriBackground', scene);
  material.backFaceCulling = false;

  mesh.material = material;
  mesh.isPickable = false;
  mesh.infiniteDistance = true;
  mesh.ignoreCameraMaxZ = true;

  return {
    setTexture(texture) {
      texture.coordinatesMode = Texture.SKYBOX_MODE;
      material.reflectionTexture = texture;
    },
    dispose() {
      material.reflectionTexture = null;
      material.dispose();
      mesh.dispose();
    },
  };
};

interface PendingEnvironment {
  readonly hdriId: string;
  readonly promise: Promise<boolean>;
  readonly resolve: (result: boolean) => void;
  texture: BaseTexture | null;
  /** In-flight native IBL filtering; the texture must outlive it. */
  filtering: Promise<void> | null;
  settled: boolean;
}

/**
 * Owns the preview scene's environment texture and its visible skybox.
 * Keeping the current environment until the next one has loaded makes failed
 * or superseded selections harmless, and every retired resource is disposed
 * exactly once.
 */
export class EnvironmentController {
  private readonly scene: Scene;
  private readonly createTexture: EnvironmentTextureFactory;
  private readonly createBackground: EnvironmentBackgroundFactory;
  private readonly createIblFilter: EnvironmentIblFilterFactory;
  private current: BaseTexture | null = null;
  private currentId: string | null = null;
  private background: EnvironmentBackground | null = null;
  private iblFilter: EnvironmentIblFilter | null = null;
  private pending: PendingEnvironment | null = null;
  private disposed = false;

  constructor(
    scene: Scene,
    createTexture: EnvironmentTextureFactory = createHdrEnvironmentTexture,
    createBackground: EnvironmentBackgroundFactory =
      createHdrEnvironmentBackground,
    createIblFilter: EnvironmentIblFilterFactory =
      createNativeEnvironmentIblFilter,
  ) {
    this.scene = scene;
    this.createTexture = createTexture;
    this.createBackground = createBackground;
    this.createIblFilter = createIblFilter;
  }

  /**
   * Loads and applies `hdri`, resolving to whether it became the active
   * environment. Selecting the active HDRI again is a no-op.
   */
  load(hdri: PreviewHdri): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);

    if (hdri.id === this.currentId) {
      // Selecting the displayed environment also cancels a swap still loading.
      this.cancelPending();
      return Promise.resolve(true);
    }

    if (this.pending?.hdriId === hdri.id) {
      return this.pending.promise;
    }

    this.cancelPending();

    let resolveEntry!: (result: boolean) => void;
    const promise = new Promise<boolean>((resolve) => {
      resolveEntry = resolve;
    });
    const entry: PendingEnvironment = {
      hdriId: hdri.id,
      promise,
      resolve: resolveEntry,
      texture: null,
      filtering: null,
      settled: false,
    };
    this.pending = entry;

    try {
      const texture = this.createTexture(
        this.scene,
        hdri.url,
        () => queueMicrotask(() => this.beginFiltering(entry, hdri)),
        () => queueMicrotask(() => this.finishError(entry)),
      );
      entry.texture = texture;
    } catch {
      this.finishError(entry);
    }

    return promise;
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.cancelPending();
    this.background?.dispose();
    this.background = null;
    this.scene.environmentTexture = null;
    this.current?.dispose();
    this.current = null;
    this.currentId = null;
  }

  /**
   * Runs the native HDR filters before the texture becomes visible. Only the
   * pending entry is processed; a superseded one is released as soon as its
   * filtering settles, because GPU filtering itself cannot be cancelled.
   */
  private beginFiltering(
    entry: PendingEnvironment,
    hdri: PreviewHdri,
  ): void {
    if (this.disposed || this.pending !== entry) {
      this.disposeTexture(entry);
      return;
    }

    const texture = entry.texture;
    if (!texture) {
      this.finishError(entry);
      return;
    }

    let filtering: Promise<void>;
    try {
      this.iblFilter ??= this.createIblFilter(this.scene);
      filtering = this.iblFilter.prefilter(texture);
    } catch {
      this.finishError(entry);
      return;
    }

    entry.filtering = filtering;
    void filtering.then(
      () => {
        entry.filtering = null;
        this.finishLoad(entry, hdri);
      },
      () => {
        entry.filtering = null;
        this.finishError(entry);
      },
    );
  }

  private finishLoad(entry: PendingEnvironment, hdri: PreviewHdri): void {
    if (this.disposed || this.pending !== entry) {
      this.disposeTexture(entry);
      return;
    }

    const texture = entry.texture;
    if (!texture) {
      this.finishError(entry);
      return;
    }

    this.pending = null;
    this.background ??= this.createBackground(this.scene);
    this.background.setTexture(texture);
    this.scene.environmentTexture = texture;
    this.current?.dispose();
    this.current = texture;
    this.currentId = hdri.id;
    // The current texture now owns disposal; a late callback must not release it.
    entry.texture = null;
    this.settle(entry, true);
  }

  private finishError(entry: PendingEnvironment): void {
    if (this.pending !== entry) {
      this.disposeTexture(entry);
      return;
    }

    this.pending = null;
    this.disposeTexture(entry);
    this.settle(entry, false);
  }

  private cancelPending(): void {
    const entry = this.pending;
    if (!entry) return;

    this.pending = null;
    this.settle(entry, false);

    // A texture being filtered is still read by the GPU; release it only once
    // the filter settles, otherwise the shader would sample disposed storage.
    if (entry.filtering) {
      void entry.filtering.then(
        () => this.disposeTexture(entry),
        () => this.disposeTexture(entry),
      );
      return;
    }

    this.disposeTexture(entry);
  }

  private disposeTexture(entry: PendingEnvironment): void {
    const texture = entry.texture;
    entry.texture = null;
    texture?.dispose();
  }

  private settle(entry: PendingEnvironment, result: boolean): void {
    if (entry.settled) return;

    entry.settled = true;
    entry.resolve(result);
  }
}
