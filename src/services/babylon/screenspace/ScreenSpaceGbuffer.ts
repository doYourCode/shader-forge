import {
  Constants,
  RawTexture,
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
import {
  SCREEN_SPACE_DISPLAY_SAMPLER_NAMES,
  SCREEN_SPACE_SAMPLER_NAMES,
} from '@/core/constants/screenSpaceAbi';
import { TRANSPARENT_OVERLAY_ENABLED } from '@/core/constants/screenSpaceRender';
import {
  orderedScreenSpaceAttachments,
  type ScreenSpaceAttachment,
} from '@/core/screenspace/gbufferAttachments';
import { ObjectIdPass } from './ObjectIdPass';
import { TransparentOverlay } from './TransparentOverlay';
import { materialsForMesh } from './SceneAssetProvider';

/** Babylon's PrePass attachment type for each public scene-data target. */
const ATTACHMENT_PREPASS_TYPES: Record<ScreenSpaceAttachment, number> = {
  depth: Constants.PREPASS_DEPTH_TEXTURE_TYPE,
  normal: Constants.PREPASS_NORMAL_TEXTURE_TYPE,
  albedo: Constants.PREPASS_ALBEDO_SQRT_TEXTURE_TYPE,
  material: Constants.PREPASS_REFLECTIVITY_TEXTURE_TYPE,
  velocity: Constants.PREPASS_VELOCITY_LINEAR_TEXTURE_TYPE,
};

export interface ScreenSpaceGbufferOptions {
  /** Renders the transparent/transmissive subset into its own target. */
  readonly transparentOverlay?: boolean;
}

/**
 * Owns every scene-data target consumed by screen-space effects:
 *
 * - Babylon's PrePass MRT, restricted to the attachments the compiled effects
 *   actually read (none for a passthrough, which keeps the scene on a plain
 *   colour target with no PrePass at all);
 * - a dedicated object-id prepass, enabled only when an effect reads it;
 * - the transparent overlay, when the pipeline asks for one.
 *
 * The PrePass renders alongside the opaque scene draw, so albedo/roughness are
 * evaluated by the same PBR materials as the visible image.
 */
export class ScreenSpaceGbuffer {
  readonly prePassConfig: PrePassEffectConfiguration;
  readonly objectId: ObjectIdPass;
  readonly overlay: TransparentOverlay | null;

  private readonly scene: Scene;
  private readonly prePass: PrePassRenderer | null;
  private readonly wrappers = new Map<number, ThinTexture>();
  private readonly beforeTargets: () => void;
  private readonly afterTargets: () => void;
  private readonly beforeTargetsObserver: Observer<Scene>;
  private readonly afterTargetsObserver: Observer<Scene>;
  private transparentFallback: RawTexture | null = null;
  private disposed = false;

  constructor(
    scene: Scene,
    camera: Camera,
    opaque: readonly AbstractMesh[],
    transparent: readonly AbstractMesh[],
    options: ScreenSpaceGbufferOptions = {},
  ) {
    this.scene = scene;
    // Attachments start empty: the first compiled stack decides what the
    // PrePass has to produce. Until then the scene renders on a plain target.
    this.prePassConfig = {
      name: 'sf-screen-space-gbuffer',
      texturesRequired: [],
      enabled: false,
    };

    this.prePass = scene.enablePrePassRenderer();
    if (this.prePass) {
      this.prePass.disableGammaTransform = true;
      this.prePass.useSpecificClearForDepthTexture = true;
      this.prePass.samples = 1;
      this.prePass.addEffectConfiguration(this.prePassConfig);
    }

    this.objectId = new ObjectIdPass(scene, camera, opaque);
    const transparentOverlay =
      options.transparentOverlay ?? TRANSPARENT_OVERLAY_ENABLED;
    this.overlay = transparentOverlay
      ? new TransparentOverlay(scene, camera, opaque, transparent)
      : null;

    if (this.overlay) this.excludeTransparentMaterials(transparent);

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

  /** The overlay target, or a transparent texel when no overlay renders. */
  get transparentTexture(): BaseTexture {
    return this.overlay?.baseTexture ?? this.fallbackTexture();
  }

  setObjectIdEnabled(enabled: boolean): void {
    this.objectId.setEnabled(enabled);
  }

  /**
   * Declares which scene-data targets the compiled stack reads. Must be
   * followed by `refreshPrePass` so Babylon rebuilds the MRT layout.
   */
  setRequiredAttachments(
    attachments: ReadonlySet<ScreenSpaceAttachment>,
  ): void {
    if (this.disposed) return;

    const next = orderedScreenSpaceAttachments(attachments).map(
      (attachment) => ATTACHMENT_PREPASS_TYPES[attachment],
    );
    const current = this.prePassConfig.texturesRequired;
    if (
      next.length === current.length &&
      next.every((type, index) => type === current[index])
    ) {
      return;
    }

    this.prePassConfig.texturesRequired = next;
  }

  setMeshes(
    opaque: readonly AbstractMesh[],
    transparent: readonly AbstractMesh[],
  ): void {
    if (this.disposed) return;

    this.objectId.setMeshes(opaque);
    this.overlay?.setMeshes(opaque, transparent);

    if (!this.prePass) return;

    this.prePass.excludedMaterials.length = 0;
    // Without an overlay the transparent surfaces render inside the main pass,
    // so their materials must keep writing the scene targets.
    if (this.overlay) this.excludeTransparentMaterials(transparent);

    this.prePass.markAsDirty();
    this.prePass.update();
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

  /** Binds the overlay (or its transparent stand-in) to a display pass. */
  bindTransparent(effect: Effect): void {
    effect.setTexture(
      SCREEN_SPACE_DISPLAY_SAMPLER_NAMES.transparent,
      this.transparentTexture,
    );
  }

  /**
   * Applies the requested attachment set and re-registers the PrePass
   * configuration on the current post-process chain. A stack that reads no
   * scene data disables the PrePass entirely, so the scene renders straight
   * into the first post-process target.
   */
  refreshPrePass(
    chain: readonly {
      _prePassEffectConfiguration?: PrePassEffectConfiguration;
    }[],
  ): void {
    if (this.disposed || !this.prePass) return;

    const enabled = this.prePassConfig.texturesRequired.length > 0;
    this.prePassConfig.enabled = enabled;

    for (const pass of chain) {
      pass._prePassEffectConfiguration = enabled
        ? this.prePassConfig
        : undefined;
    }

    this.prePass.markAsDirty();
    this.prePass.update();
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
    this.objectId.resize(width, height);
    this.overlay?.resize(width, height);
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
    this.overlay?.dispose();
    this.transparentFallback?.dispose();
    this.transparentFallback = null;

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
    sampler: ScreenSpaceAttachment,
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

  /**
   * A single transparent texel keeps the display shader unchanged when no
   * overlay is rendered: `overlay.rgb + color * (1 - overlay.a)` collapses to
   * the effect output.
   */
  private fallbackTexture(): RawTexture {
    if (!this.transparentFallback) {
      this.transparentFallback = RawTexture.CreateRGBATexture(
        new Uint8Array([0, 0, 0, 0]),
        1,
        1,
        this.scene,
        false,
        false,
        Constants.TEXTURE_NEAREST_SAMPLINGMODE,
      );
    }

    return this.transparentFallback;
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
