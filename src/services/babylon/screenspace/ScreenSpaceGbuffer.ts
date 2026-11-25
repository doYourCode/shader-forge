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
 * - the transparent overlay, when the pipeline asks for one.
 *
 * The PrePass renders alongside the opaque scene draw, so albedo/roughness are
 * evaluated by the same PBR materials as the visible image.
 */
export class ScreenSpaceGbuffer {
  readonly prePassConfig: PrePassEffectConfiguration;
  readonly overlay: TransparentOverlay | null;

  private readonly scene: Scene;
  private readonly prePass: PrePassRenderer | null;
  private readonly wrappers = new Map<number, ThinTexture>();
  private readonly beforeTargets: () => void;
  private readonly afterTargets: () => void;
  private readonly beforeTargetsObserver: Observer<Scene>;
  private readonly afterTargetsObserver: Observer<Scene>;
  private sceneColorWrapper: ThinTexture | null = null;
  private sceneColorInternal: InternalTexture | null = null;
  private appliedAttachments: readonly number[] = [];
  private appliedEnabled = false;
  private applied = false;
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

  /**
   * The unmodified scene colour produced by the PrePass, or null when the
   * PrePass is not active. Babylon's post-process `inputTexture` is the
   * pass output target, so it cannot stand in for the original scene colour.
   */
  sceneColorTexture(): ThinTexture | null {
    // `prePass.enabled` is toggled around custom render targets, so use the
    // configuration and the render target's own enabled flag instead.
    if (
      this.disposed ||
      !this.prePassConfig.enabled ||
      !this.prePass?.defaultRT.enabled
    ) {
      return null;
    }

    const internal =
      this.prePass.defaultRT.textures?.[0]?.getInternalTexture() ?? null;
    if (!internal) return null;

    if (this.sceneColorInternal !== internal) {
      // A new ThinTexture is only a view over the PrePass-owned texture.
      this.sceneColorWrapper = new ThinTexture(internal);
      this.sceneColorInternal = internal;
    }

    return this.sceneColorWrapper;
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
  }

  /** Binds the overlay (or its transparent stand-in) to a display pass. */
  bindTransparent(effect: Effect): void {
    effect.setTexture(
      SCREEN_SPACE_DISPLAY_SAMPLER_NAMES.transparent,
      this.transparentTexture,
    );
  }

  /**
   * Camera attach/detach marks Babylon's PrePass dirty even when the MRT
   * layout did not change. After a chain swap, clear that pending rebuild so
   * the next frame only links the new first pass; the layout is already in
   * the state `refreshPrePass` applied.
   */
  settlePrePass(): void {
    if (!this.prePass || !this.applied) return;

    const enabled = this.prePassConfig.texturesRequired.length > 0;
    if (
      enabled !== this.appliedEnabled ||
      !sameAttachmentTypes(
        this.prePassConfig.texturesRequired,
        this.appliedAttachments,
      )
    ) {
      return;
    }

    // Babylon exposes no public API to acknowledge a chain change separately
    // from a layout rebuild. Keep the one internal write isolated here.
    const prePass = this.prePass as unknown as { _isDirty?: boolean };
    prePass._isDirty = false;
  }

  /**
   * Applies the requested attachment set and re-registers the PrePass
   * configuration on the current post-process chain. A stack that reads no
   * scene data disables the PrePass entirely, so the scene renders straight
   * into the first post-process target.
   *
   * Babylon's `update()` is expensive: it tears down the MRT, marks every
   * scene material pre-pass dirty and re-links the post-process chain. Only
   * run it when the enabled state or the MRT layout actually changed. A new
   * chain with the same layout still gets the configuration assigned above;
   * Babylon links its first pass on the next frame.
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

    // Without a post process there is nothing Babylon can enable. Keep the
    // state "not applied" so the next refresh (after the chain is installed)
    // performs the real update.
    if (enabled && chain.length === 0) return;

    const layoutChanged =
      enabled !== this.appliedEnabled ||
      !sameAttachmentTypes(
        this.prePassConfig.texturesRequired,
        this.appliedAttachments,
      );

    if (this.applied && !layoutChanged) return;

    this.prePass.markAsDirty();
    this.prePass.update();

    this.applied = true;
    this.appliedEnabled = enabled;
    this.appliedAttachments = [...this.prePassConfig.texturesRequired];
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
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

    this.overlay?.dispose();
    this.transparentFallback?.dispose();
    this.transparentFallback = null;

    // Wrappers are views over PrePass-owned textures; dropping the map is the
    // only safe release. Babylon disposes the attachments with the PrePass.
    this.wrappers.clear();
    this.sceneColorWrapper = null;
    this.sceneColorInternal = null;

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

function sameAttachmentTypes(
  first: readonly number[],
  second: readonly number[],
): boolean {
  return (
    first.length === second.length &&
    first.every((type, index) => type === second[index])
  );
}
