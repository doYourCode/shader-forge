import {
  Color4,
  Constants,
  RenderTargetTexture,
  ShaderMaterial,
  type AbstractMesh,
  type Camera,
  type Effect,
  type Material,
  type Scene,
} from '@babylonjs/core';
import objectIdVertex from '@/assets/internal-shaders/object.id.vert.glsl?raw';
import objectIdFragment from '@/assets/internal-shaders/object.id.frag.glsl?raw';
import { SCREEN_SPACE_SAMPLER_NAMES } from '@/core/constants/screenSpaceAbi';

interface IdEntry {
  readonly mesh: AbstractMesh;
  readonly material: ShaderMaterial;
  previous: Material | null;
}

const MAX_OBJECT_ID = 0xffffff;

/**
 * A small R32F prepass that writes one stable id per opaque mesh.
 *
 * Babylon's geometry buffer can emit object ids, but it cannot be linked to
 * the PrePass renderer that supplies albedo/reflectivity/velocity. A dedicated
 * id prepass keeps both features available; it only reads positions, so it is
 * cheap compared with the PBR scene draw.
 */
export class ObjectIdPass {
  readonly texture: RenderTargetTexture;

  private readonly scene: Scene;
  private readonly camera: Camera;
  private entries: IdEntry[] = [];
  private meshes: readonly AbstractMesh[] = [];
  private enabled = false;
  private disposed = false;

  constructor(scene: Scene, camera: Camera, meshes: readonly AbstractMesh[]) {
    this.scene = scene;
    this.camera = camera;

    this.texture = new RenderTargetTexture(
      'sf-screen-space-object-id',
      { width: renderWidth(scene), height: renderHeight(scene) },
      scene,
      {
        generateMipMaps: false,
        doNotChangeAspectRatio: true,
        type: Constants.TEXTURETYPE_FLOAT,
        format: Constants.TEXTUREFORMAT_R,
        samplingMode: Constants.TEXTURE_NEAREST_SAMPLINGMODE,
        generateDepthBuffer: true,
        generateStencilBuffer: false,
      },
    );
    this.texture.clearColor = new Color4(0, 0, 0, 1);
    this.texture.noPrePassRenderer = true;
    this.texture.refreshRate =
      RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
    this.texture.activeCamera = camera;
    this.texture.onBeforeRenderObservable.add(() => this.swapIn());
    this.texture.onAfterRenderObservable.add(() => this.swapOut());

    this.setMeshes(meshes);
    this.setEnabled(false);
    scene.customRenderTargets.push(this.texture);
  }

  setMeshes(meshes: readonly AbstractMesh[]): void {
    if (this.disposed) return;

    this.swapOut();
    this.disposeEntries();
    this.meshes = meshes;
    this.applyEnabled();
  }

  /**
   * The id pass is opt-in: rendering every opaque mesh a second time costs a
   * full extra scene pass. It is enabled only when the debug view or a user
   * effect actually references the object-id texture.
   */
  setEnabled(enabled: boolean): void {
    if (this.disposed || this.enabled === enabled) return;

    this.enabled = enabled;
    this.applyEnabled();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  bind(effect: Effect): void {
    effect.setTexture(SCREEN_SPACE_SAMPLER_NAMES.objectId, this.texture);
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
    this.texture.resize({ width, height });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.swapOut();
    const index = this.scene.customRenderTargets.indexOf(this.texture);
    if (index >= 0) this.scene.customRenderTargets.splice(index, 1);

    this.disposeEntries();
    this.texture.dispose();
  }

  private applyEnabled(): void {
    if (this.enabled && this.entries.length === 0) {
      this.entries = this.meshes.map((mesh) => ({
        mesh,
        material: createIdMaterial(this.scene, objectIdFor(mesh)),
        previous: null,
      }));
    }
    if (!this.enabled) this.disposeEntries();

    this.texture.renderList = this.enabled ? this.meshes.slice() : [];
    this.texture.refreshRate = this.enabled
      ? RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME
      : RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    if (this.enabled) this.texture.resetRefreshCounter();
  }

  private swapIn(): void {
    if (!this.enabled) return;

    for (const entry of this.entries) {
      entry.previous = entry.mesh.material;
      entry.mesh.computeWorldMatrix(true);
      entry.mesh.material = entry.material;
      entry.material.setMatrix('world', entry.mesh.getWorldMatrix());
      entry.material.setMatrix(
        'viewProjection',
        this.camera.getViewMatrix().multiply(this.camera.getProjectionMatrix()),
      );
    }
  }

  private swapOut(): void {
    for (const entry of this.entries) {
      if (entry.previous !== null || entry.mesh.material === entry.material) {
        entry.mesh.material = entry.previous;
        entry.previous = null;
      }
    }
  }

  private disposeEntries(): void {
    for (const entry of this.entries) entry.material.dispose();
    this.entries = [];
  }
}

function createIdMaterial(scene: Scene, objectId: number): ShaderMaterial {
  const material = new ShaderMaterial(
    `sf-object-id-${objectId}`,
    scene,
    { vertexSource: objectIdVertex, fragmentSource: objectIdFragment },
    {
      attributes: ['position'],
      uniforms: ['world', 'viewProjection', 'objectId'],
      samplers: [],
    },
    false,
  );
  material.backFaceCulling = true;
  material.setFloat('objectId', objectId);

  return material;
}

function objectIdFor(mesh: AbstractMesh): number {
  return mesh.uniqueId % (MAX_OBJECT_ID + 1);
}

function renderWidth(scene: Scene): number {
  return scene.getEngine().getRenderWidth();
}

function renderHeight(scene: Scene): number {
  return scene.getEngine().getRenderHeight();
}
