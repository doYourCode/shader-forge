import {
  Constants,
  ThinTexture,
  type AbstractMesh,
  type BaseTexture,
  type Camera,
  type Effect,
  type InternalTexture,
  type Observer,
  type PrePassRenderer,
  type Scene,
} from '@babylonjs/core';
import type { PrePassEffectConfiguration } from '@babylonjs/core/Rendering/prePassEffectConfiguration';
import { SCREEN_SPACE_SAMPLER_NAMES } from '@/core/constants/screenSpaceAbi';
import { ObjectIdPass } from './ObjectIdPass';
import { TransparentOverlay } from './TransparentOverlay';
import { materialsForMesh } from './SceneAssetProvider';

/** The attachments the screen-space ABI expects from Babylon's PrePass. */
const REQUIRED_TEXTURES = [
  Constants.PREPASS_DEPTH_TEXTURE_TYPE,
  Constants.PREPASS_NORMAL_TEXTURE_TYPE,
  Constants.PREPASS_ALBEDO_SQRT_TEXTURE_TYPE,
  Constants.PREPASS_REFLECTIVITY_TEXTURE_TYPE,
  Constants.PREPASS_VELOCITY_LINEAR_TEXTURE_TYPE,
];

/**
 * Owns every scene-data target consumed by screen-space effects:
 *
 * - Babylon's PrePass MRT: depth, normal, albedo, reflectivity, velocity;
 * - a dedicated object-id prepass;
 * - the transparent overlay target.
 *
 * The PrePass renders alongside the opaque scene draw, so albedo/roughness are
 * evaluated by the same PBR materials as the visible image. Transparent and
 * transmissive materials are excluded from it.
 */
export class ScreenSpaceGbuffer {
  readonly prePassConfig: PrePassEffectConfiguration;
  readonly objectId: ObjectIdPass;
  readonly overlay: TransparentOverlay;

  private readonly scene: Scene;
  private readonly prePass: PrePassRenderer | null;
  private readonly wrappers = new Map<number, ThinTexture>();
  private readonly beforeTargets: () => void;
  private readonly afterTargets: () => void;
  private readonly beforeTargetsObserver: Observer<Scene>;
  private readonly afterTargetsObserver: Observer<Scene>;
  private disposed = false;

  constructor(
    scene: Scene,
    camera: Camera,
    opaque: readonly AbstractMesh[],
    transparent: readonly AbstractMesh[],
  ) {
    this.scene = scene;
    this.prePassConfig = {
      name: 'sf-screen-space-gbuffer',
      texturesRequired: REQUIRED_TEXTURES,
      enabled: true,
    };

    this.prePass = scene.enablePrePassRenderer();
    if (this.prePass) {
      this.prePass.disableGammaTransform = true;
      this.prePass.useSpecificClearForDepthTexture = true;
      this.prePass.samples = 1;
      this.prePass.addEffectConfiguration(this.prePassConfig);
      this.excludeTransparentMaterials(transparent);
    }

    this.objectId = new ObjectIdPass(scene, camera, opaque);
    this.overlay = new TransparentOverlay(scene, camera, opaque, transparent);

    // Custom render targets run before the main camera. PrePass must not bind
    // its MRT attachments while those targets are the current framebuffer:
    // their materials are still PBR, so Babylon would otherwise try to write
    // the scene G-buffer into the overlay/id framebuffer.
    this.beforeTargets = () => this.setPrePassEnabled(false);
    this.afterTargets = () => this.setPrePassEnabled(true);
    this.beforeTargetsObserver =
      scene.onBeforeRenderTargetsRenderObservable.add(() =>
        this.beforeTargets(),
      );
    this.afterTargetsObserver = scene.onAfterRenderTargetsRenderObservable.add(
      () => this.afterTargets(),
    );
  }

  get supported(): boolean {
    return this.prePass !== null;
  }

  get transparentTexture(): BaseTexture {
    return this.overlay.baseTexture;
  }

  setObjectIdEnabled(enabled: boolean): void {
    this.objectId.setEnabled(enabled);
  }

  setMeshes(
    opaque: readonly AbstractMesh[],
    transparent: readonly AbstractMesh[],
  ): void {
    if (this.disposed) return;

    this.objectId.setMeshes(opaque);
    this.overlay.setMeshes(opaque, transparent);

    if (this.prePass) {
      this.prePass.excludedMaterials.length = 0;
      this.excludeTransparentMaterials(transparent);
      this.refreshPrePass([]);
    }
  }

  /** Binds every public G-buffer sampler to `effect`. */
  bind(effect: Effect): void {
    this.bindPrePass(effect, Constants.PREPASS_DEPTH_TEXTURE_TYPE, 'depth');
    this.bindPrePass(effect, Constants.PREPASS_NORMAL_TEXTURE_TYPE, 'normal');
    this.bindPrePass(
      effect,
      Constants.PREPASS_ALBEDO_SQRT_TEXTURE_TYPE,
      'albedo',
    );
    this.bindPrePass(
      effect,
      Constants.PREPASS_REFLECTIVITY_TEXTURE_TYPE,
      'material',
    );
    this.bindPrePass(
      effect,
      Constants.PREPASS_VELOCITY_LINEAR_TEXTURE_TYPE,
      'velocity',
    );
    this.objectId.bind(effect);
  }

  /**
   * Re-registers the PrePass configuration on the current post-process chain
   * and forces Babylon to rebuild the attachment layout.
   */
  refreshPrePass(
    chain: readonly {
      _prePassEffectConfiguration?: PrePassEffectConfiguration;
    }[],
  ): void {
    if (this.disposed || !this.prePass) return;

    for (const pass of chain) {
      pass._prePassEffectConfiguration = this.prePassConfig;
    }

    this.prePass.markAsDirty();
    this.prePass.update();
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
    this.objectId.resize(width, height);
    this.overlay.resize(width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.scene.onBeforeRenderTargetsRenderObservable.remove(
      this.beforeTargetsObserver,
    );
    this.scene.onAfterRenderTargetsRenderObservable.remove(
      this.afterTargetsObserver,
    );

    this.objectId.dispose();
    this.overlay.dispose();

    // Wrappers are views over PrePass-owned textures; dropping the map is the
    // only safe release. Babylon disposes the attachments with the PrePass.
    this.wrappers.clear();

    this.scene.disablePrePassRenderer();
  }

  /** Babylon keeps `_setEnabled` internal; toggling it is the supported way
   * to keep PrePass out of the custom-target framebuffers. */
  private setPrePassEnabled(enabled: boolean): void {
    const prePass = this.prePass as unknown as {
      _setEnabled?: (value: boolean) => void;
    } | null;
    prePass?._setEnabled?.(enabled);
  }

  private bindPrePass(
    effect: Effect,
    type: number,
    sampler: 'depth' | 'normal' | 'albedo' | 'material' | 'velocity',
  ): void {
    const wrapper = this.wrap(type);
    if (wrapper)
      effect.setTexture(SCREEN_SPACE_SAMPLER_NAMES[sampler], wrapper);
  }

  private wrap(type: number): ThinTexture | null {
    const prePass = this.prePass;
    if (!prePass) return null;

    const index = prePass.getIndex(type);
    if (index < 0) return null;

    const attachment = prePass.defaultRT.textures?.[index] ?? null;
    const internal: InternalTexture | null =
      attachment?.getInternalTexture() ?? null;
    if (!internal) return null;

    const current = this.wrappers.get(type);
    if (current?.getInternalTexture() === internal) return current;

    const wrapper = new ThinTexture(internal);
    this.wrappers.set(type, wrapper);
    return wrapper;
  }

  private excludeTransparentMaterials(
    transparent: readonly AbstractMesh[],
  ): void {
    if (!this.prePass) return;

    for (const mesh of transparent) {
      for (const material of materialsForMesh(mesh)) {
        if (!this.prePass.excludedMaterials.includes(material)) {
          this.prePass.excludedMaterials.push(material);
        }
      }
    }
  }
}
