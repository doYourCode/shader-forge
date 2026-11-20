import {
  BackgroundMaterial,
  CreateBox,
  CubeTexture,
  HDRCubeTexture,
  Texture,
  type BaseTexture,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import type { PreviewHdri, PreviewHdriFormat } from '@/core/models/previewHdri';
import { LatestLoad, type PendingLoad } from '@/core/async/latestLoad';
import {
  createNativeEnvironmentIblFilter,
  type EnvironmentIblFilter,
  type EnvironmentIblFilterFactory,
} from './IblFiltering';
import { noopLoadTimer, type LoadTimer } from '@/services/perf/LoadProfiler';

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
  format: PreviewHdriFormat,
  onLoad: () => void,
  onError: () => void,
) => BaseTexture;

/** Loads one storage format; both arms share the same callback contract. */
type EnvironmentTextureLoader = (
  scene: Scene,
  url: string,
  onLoad: () => void,
  onError: () => void,
) => BaseTexture;

/**
 * Raw RGBE panorama: decoded and converted to a cubemap on the CPU and then
 * filtered on the GPU by the controller. Harmonics are not requested because
 * the preview reads the irradiance/radiance cubemaps directly; computing the
 * spherical polynomial would only add load-time CPU work.
 */
export const createHdrEnvironmentTexture: EnvironmentTextureLoader = (
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
    false,
    false,
    false,
    onLoad,
    onError,
  );

/**
 * Prefiltered `.env`: Babylon's own container, which already holds the radiance
 * mip chain (roughness in the mip levels) and the irradiance cubemap. It is
 * uploaded as-is, so no decode, panorama conversion or GPU filtering happens at
 * load time.
 */
export const createPrefilteredEnvironmentTexture: EnvironmentTextureLoader = (
  scene,
  url,
  onLoad,
  onError,
) =>
  new CubeTexture(url, scene, {
    prefiltered: true,
    createPolynomials: false,
    onLoad,
    onError,
  });

/** Picks the loader from the catalog entry's declared storage format. */
export const createEnvironmentTexture: EnvironmentTextureFactory = (
  scene,
  url,
  format,
  onLoad,
  onError,
) =>
  format === 'env'
    ? createPrefilteredEnvironmentTexture(scene, url, onLoad, onError)
    : createHdrEnvironmentTexture(scene, url, onLoad, onError);

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
export const createEnvironmentBackground: EnvironmentBackgroundFactory = (
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
  /**
   * Whether the texture still needs Babylon's HDR filters. Prefiltered `.env`
   * assets are already convolved and go straight to `finishLoad`.
   */
  readonly needsFiltering: boolean;
  texture: BaseTexture | null;
  /** In-flight native IBL filtering; the texture must outlive it. */
  filtering: Promise<void> | null;
  /** Open `env:load` timing sample; ended when the texture reports ready. */
  stopLoadTimer: (() => void) | null;
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
  private readonly timer: LoadTimer;
  private current: BaseTexture | null = null;
  private currentId: string | null = null;
  private background: EnvironmentBackground | null = null;
  private iblFilter: EnvironmentIblFilter | null = null;
  private readonly pending = new LatestLoad<boolean, PendingEnvironment>(false);
  private disposed = false;

  constructor(
    scene: Scene,
    createTexture: EnvironmentTextureFactory = createEnvironmentTexture,
    createBackground: EnvironmentBackgroundFactory = createEnvironmentBackground,
    createIblFilter: EnvironmentIblFilterFactory = createNativeEnvironmentIblFilter,
    /**
     * Optional load-phase instrumentation. The controller owns the split
     * between fetching/decoding (`env:load`) and GPU filtering (`env:filter`),
     * which is where the environment cost actually lives.
     */
    timer: LoadTimer = noopLoadTimer,
  ) {
    this.scene = scene;
    this.createTexture = createTexture;
    this.createBackground = createBackground;
    this.createIblFilter = createIblFilter;
    this.timer = timer;
  }

  /**
   * Loads and applies `hdri`, resolving to whether it became the active
   * environment. Selecting the active HDRI again is a no-op.
   */
  load(hdri: PreviewHdri): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);

    if (hdri.id === this.currentId) {
      // Selecting the displayed environment also cancels a swap still loading.
      this.pending.cancel();
      return Promise.resolve(true);
    }

    const inFlight = this.pending.get();
    if (inFlight?.payload.hdriId === hdri.id) {
      return inFlight.promise;
    }

    const entry: PendingEnvironment = {
      hdriId: hdri.id,
      needsFiltering: hdri.format === 'hdr',
      texture: null,
      filtering: null,
      stopLoadTimer: this.timer.begin('env:load'),
    };
    // Starting a request retires any older one, including its texture.
    const load = this.pending.begin(entry, (pending) =>
      this.retireEnvironment(pending),
    );

    try {
      entry.texture = this.createTexture(
        this.scene,
        hdri.url,
        hdri.format,
        () => queueMicrotask(() => this.onTextureLoaded(load, hdri)),
        () => queueMicrotask(() => this.finishError(load)),
      );
    } catch {
      this.finishError(load);
    }

    return load.promise;
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.pending.dispose();
    this.background?.dispose();
    this.background = null;
    this.scene.environmentTexture = null;
    this.current?.dispose();
    this.current = null;
    this.currentId = null;
  }

  /**
   * Runs after the texture reports it is ready. Prefiltered assets are complete
   * on arrival; raw HDR panoramas still need the native filters. Only the
   * pending entry is processed, and a superseded one is released as soon as its
   * filtering settles, because GPU filtering itself cannot be cancelled.
   */
  private onTextureLoaded(
    load: PendingLoad<boolean, PendingEnvironment>,
    hdri: PreviewHdri,
  ): void {
    // A retired request is already settled and released by the slot.
    if (this.disposed || !load.isCurrent()) return;

    const entry = load.payload;
    const texture = entry.texture;
    if (!texture) {
      this.finishError(load);
      return;
    }

    // Fetch/decode/upload is done here, before any filtering starts, so the
    // two costs are reported as separate phases.
    this.stopLoadTimer(entry);

    if (!entry.needsFiltering) {
      this.finishLoad(load, hdri);
      return;
    }

    let filtering: Promise<void>;
    try {
      this.iblFilter ??= this.createIblFilter(this.scene);
      filtering = this.timer.measure('env:filter', () =>
        this.iblFilter!.prefilter(texture),
      );
    } catch {
      this.finishError(load);
      return;
    }

    entry.filtering = filtering;
    void filtering.then(
      () => {
        entry.filtering = null;
        this.finishLoad(load, hdri);
      },
      () => {
        entry.filtering = null;
        this.finishError(load);
      },
    );
  }

  private finishLoad(
    load: PendingLoad<boolean, PendingEnvironment>,
    hdri: PreviewHdri,
  ): void {
    if (this.disposed || !load.isCurrent()) return;

    const entry = load.payload;
    const texture = entry.texture;
    if (!texture) {
      this.finishError(load);
      return;
    }

    this.background ??= this.createBackground(this.scene);
    this.background.setTexture(texture);
    this.scene.environmentTexture = texture;
    this.current?.dispose();
    this.current = texture;
    this.currentId = hdri.id;
    // The current texture now owns disposal; a late callback must not release it.
    entry.texture = null;
    load.settle(true);
  }

  private finishError(load: PendingLoad<boolean, PendingEnvironment>): void {
    if (load.isCurrent()) load.settle(false);
  }

  /**
   * Releases a retired request. GPU filtering cannot be cancelled, so a texture
   * that is still being filtered stays alive until the filter settles.
   */
  private retireEnvironment(entry: PendingEnvironment): void {
    this.stopLoadTimer(entry);

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
    this.stopLoadTimer(entry);
    entry.texture = null;
    texture?.dispose();
  }

  /** Ends the open env:load sample exactly once. */
  private stopLoadTimer(entry: PendingEnvironment): void {
    entry.stopLoadTimer?.();
    entry.stopLoadTimer = null;
  }
}

/**
 * Wires the production collaborators (format dispatch, skybox, native filters)
 * with optional load instrumentation. Used by `SceneManager`'s default deps.
 */
export function createDefaultEnvironmentController(
  scene: Scene,
  timer: LoadTimer = noopLoadTimer,
): EnvironmentController {
  return new EnvironmentController(
    scene,
    createEnvironmentTexture,
    createEnvironmentBackground,
    createNativeEnvironmentIblFilter,
    timer,
  );
}
