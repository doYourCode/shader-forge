import {
  Color4,
  Constants,
  RenderTargetTexture,
  type AbstractMesh,
  type BaseTexture,
  type Camera,
  type Effect,
  type Scene,
} from '@babylonjs/core';
import { SCREEN_SPACE_DISPLAY_SAMPLER_NAMES } from '@/core/constants/screenSpaceAbi';

/**
 * Renders the transparent/transmissive subset into its own HDR target.
 *
 * The overlay is deliberately transparent-only: an opaque depth prepass would
 * add a full extra scene draw (thousands of calls on a Bistro-sized scene) for
 * a small occlusion gain. Transparent surfaces are depth-tested against each
 * other and composited after the screen-space chain by the display pass.
 *
 * Standard alpha blending over a transparent-black clear yields premultiplied
 * colour plus coverage in alpha, so the display pass reconstructs:
 * `overlay.rgb + post.rgb * (1 - overlay.a)`.
 */
export class TransparentOverlay {
  readonly texture: RenderTargetTexture;

  private readonly scene: Scene;
  private readonly camera: Camera;
  private previousLayerMask = 0xffffffff;
  private prepared = false;
  private disposed = false;

  constructor(
    scene: Scene,
    camera: Camera,
    _opaque: readonly AbstractMesh[],
    transparent: readonly AbstractMesh[],
  ) {
    this.scene = scene;
    this.camera = camera;

    this.texture = new RenderTargetTexture(
      'sf-screen-space-transparent',
      { width: renderWidth(scene), height: renderHeight(scene) },
      scene,
      {
        generateMipMaps: false,
        doNotChangeAspectRatio: true,
        type: colorTextureType(scene),
        format: Constants.TEXTUREFORMAT_RGBA,
        samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
        generateDepthBuffer: true,
        generateStencilBuffer: false,
      },
    );
    this.texture.clearColor = new Color4(0, 0, 0, 0);
    this.texture.noPrePassRenderer = true;
    this.texture.refreshRate =
      RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
    this.texture.activeCamera = camera;
    this.texture.onBeforeRenderObservable.add(() => this.prepare());
    this.texture.onAfterRenderObservable.add(() => this.restore());

    this.setMeshes([], transparent);
    scene.customRenderTargets.push(this.texture);
  }

  get baseTexture(): BaseTexture {
    return this.texture;
  }

  setMeshes(
    _opaque: readonly AbstractMesh[],
    transparent: readonly AbstractMesh[],
  ): void {
    if (this.disposed) return;

    this.texture.renderList = transparent.slice();
  }

  bind(effect: Effect): void {
    effect.setTexture(
      SCREEN_SPACE_DISPLAY_SAMPLER_NAMES.transparent,
      this.texture,
    );
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
    this.texture.resize({ width, height });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.restore();
    const index = this.scene.customRenderTargets.indexOf(this.texture);
    if (index >= 0) this.scene.customRenderTargets.splice(index, 1);
    this.texture.dispose();
  }

  private prepare(): void {
    if (this.prepared) return;
    this.prepared = true;
    // The transparent subsets use layer 2; the main camera only sees layer 1.
    this.previousLayerMask = this.camera.layerMask;
    this.camera.layerMask = 0xffffffff;
  }

  private restore(): void {
    if (!this.prepared) return;
    this.prepared = false;
    this.camera.layerMask = this.previousLayerMask;
  }
}

function colorTextureType(scene: Scene): number {
  const caps = scene.getEngine().getCaps();
  if (caps.textureHalfFloatRender) return Constants.TEXTURETYPE_HALF_FLOAT;
  if (caps.textureFloatRender) return Constants.TEXTURETYPE_FLOAT;
  return Constants.TEXTURETYPE_UNSIGNED_BYTE;
}

function renderWidth(scene: Scene): number {
  return scene.getEngine().getRenderWidth();
}

function renderHeight(scene: Scene): number {
  return scene.getEngine().getRenderHeight();
}
