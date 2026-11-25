import {
  Color4,
  Constants,
  Matrix,
  RenderTargetTexture,
  ShaderMaterial,
  type Camera,
  type Effect,
  type Material,
  type Mesh,
  type Scene,
} from '@babylonjs/core';
import { POST_EFFECT_SAMPLER_NAMES } from '@/core/constants/postEffectAbi';
import { internalShaders } from '../../internalShaders';
import { updateNormalMatrix } from '../mesh/MeshMatricesProc';

const NORMAL_UNIFORMS = ['world', 'view', 'projection', 'normalMatrix'];
const DEPTH_UNIFORMS = [
  'world',
  'view',
  'projection',
  'cameraNear',
  'cameraFar',
];

/**
 * Geometry prepasses for view-space effects.
 *
 * Babylon's `PostProcess` only exposes the colour of the previous pass, so
 * ambient occlusion and contact shadows need geometry data rendered into
 * off-screen targets first. Two targets are rendered:
 *
 * - normals (rgba half float): view-space normal in rgb;
 * - depth (r float): linear view depth normalised to the camera clip range.
 *
 * Depth gets its own single-channel float target instead of sharing the normal
 * buffer's alpha: it keeps full precision for screen-space comparisons and
 * avoids the low dynamic range of a normalised 8-bit channel. Both passes are
 * registered as scene custom render targets on demand, which Babylon draws
 * after the before-render stage and before the camera, so the first post
 * process already sees complete buffers.
 *
 * The passes draw the mesh with dedicated materials, so vertex displacement
 * performed by a user's surface shader is not reflected here.
 */
export class ViewSpaceGbuffer {
  readonly texture: RenderTargetTexture;
  readonly depthTexture: RenderTargetTexture;

  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly normalMaterial: ShaderMaterial;
  private readonly depthMaterial: ShaderMaterial;
  private readonly inverseWorld = Matrix.Identity();
  private readonly normalMatrix = Matrix.Identity();
  private mesh: Mesh;
  private normalPreviousMaterial: Material | null = null;
  private normalSwapped = false;
  private depthPreviousMaterial: Material | null = null;
  private depthSwapped = false;
  private active = false;
  private disposed = false;

  constructor(
    scene: Scene,
    camera: Camera,
    mesh: Mesh,
    width: number,
    height: number,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.mesh = mesh;

    this.normalMaterial = new ShaderMaterial(
      'sf-gbuffer-normal-material',
      scene,
      {
        vertexSource: internalShaders.post.gbuffer.vertex,
        fragmentSource: internalShaders.post.gbuffer.fragment,
      },
      {
        attributes: ['position', 'normal'],
        uniforms: [...NORMAL_UNIFORMS],
        samplers: [],
      },
      false,
    );

    this.depthMaterial = new ShaderMaterial(
      'sf-gbuffer-depth-material',
      scene,
      {
        vertexSource: internalShaders.post.depth.vertex,
        fragmentSource: internalShaders.post.depth.fragment,
      },
      {
        attributes: ['position'],
        uniforms: [...DEPTH_UNIFORMS],
        samplers: [],
      },
      false,
    );

    this.texture = new RenderTargetTexture(
      'sf-gbuffer',
      { width, height },
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
    this.texture.refreshRate =
      RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
    this.texture.activeCamera = camera;
    this.texture.renderList = [mesh];
    this.texture.onBeforeRenderObservable.add(() => this.prepareNormals());
    this.texture.onAfterRenderObservable.add(() => this.restoreNormals());

    this.depthTexture = new RenderTargetTexture(
      'sf-depth',
      { width, height },
      scene,
      {
        generateMipMaps: false,
        doNotChangeAspectRatio: true,
        type: depthTextureType(scene),
        format: Constants.TEXTUREFORMAT_R,
        samplingMode: Constants.TEXTURE_NEAREST_SAMPLINGMODE,
        generateDepthBuffer: true,
        generateStencilBuffer: false,
      },
    );
    // Background pixels read as the far plane so depth comparisons never hit
    // an "at the camera" value.
    this.depthTexture.clearColor = new Color4(1, 1, 1, 1);
    this.depthTexture.refreshRate =
      RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
    this.depthTexture.activeCamera = camera;
    this.depthTexture.renderList = [mesh];
    this.depthTexture.onBeforeRenderObservable.add(() => this.prepareDepth());
    this.depthTexture.onAfterRenderObservable.add(() => this.restoreDepth());
  }

  /**
   * Registers (or removes) both geometry passes for the scene.
   *
   * The targets only render when an installed effect actually samples them:
   * otherwise every frame would draw the preview mesh twice more for buffers
   * nothing reads. The targets stay allocated so a later compile can switch
   * them back on without a hitch.
   */
  setActive(active: boolean): void {
    if (this.disposed || this.active === active) return;

    this.active = active;
    for (const target of [this.texture, this.depthTexture]) {
      setCustomRenderTarget(this.scene, target, active);
    }
  }

  setMesh(mesh: Mesh): void {
    this.mesh = mesh;
    this.texture.renderList = [mesh];
    this.depthTexture.renderList = [mesh];
  }

  bind(effect: Effect): void {
    effect.setTexture(POST_EFFECT_SAMPLER_NAMES.gbuffer, this.texture);
    effect.setTexture(POST_EFFECT_SAMPLER_NAMES.depth, this.depthTexture);
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
    this.texture.resize({ width, height });
    this.depthTexture.resize({ width, height });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.restoreNormals();
    this.restoreDepth();
    setCustomRenderTarget(this.scene, this.texture, false);
    setCustomRenderTarget(this.scene, this.depthTexture, false);
    this.texture.dispose();
    this.depthTexture.dispose();
    this.normalMaterial.dispose();
    this.depthMaterial.dispose();
  }

  private prepareNormals(): void {
    if (this.disposed) return;

    const mesh = this.mesh;
    mesh.computeWorldMatrix(true);

    this.normalMaterial.setMatrix('world', mesh.getWorldMatrix());
    this.normalMaterial.setMatrix('view', this.camera.getViewMatrix());
    this.normalMaterial.setMatrix(
      'projection',
      this.camera.getProjectionMatrix(),
    );
    updateNormalMatrix(
      mesh,
      this.normalMaterial,
      this.inverseWorld,
      this.normalMatrix,
    );

    this.normalPreviousMaterial = mesh.material;
    mesh.material = this.normalMaterial;
    this.normalSwapped = true;
  }

  private prepareDepth(): void {
    if (this.disposed) return;

    const mesh = this.mesh;
    mesh.computeWorldMatrix(true);

    this.depthMaterial.setMatrix('world', mesh.getWorldMatrix());
    this.depthMaterial.setMatrix('view', this.camera.getViewMatrix());
    this.depthMaterial.setMatrix(
      'projection',
      this.camera.getProjectionMatrix(),
    );
    this.depthMaterial.setFloat('cameraNear', this.camera.minZ);
    this.depthMaterial.setFloat('cameraFar', this.camera.maxZ);

    this.depthPreviousMaterial = mesh.material;
    mesh.material = this.depthMaterial;
    this.depthSwapped = true;
  }

  private restoreNormals(): void {
    if (!this.normalSwapped) return;

    this.mesh.material = this.normalPreviousMaterial;
    this.normalPreviousMaterial = null;
    this.normalSwapped = false;
  }

  private restoreDepth(): void {
    if (!this.depthSwapped) return;

    this.mesh.material = this.depthPreviousMaterial;
    this.depthPreviousMaterial = null;
    this.depthSwapped = false;
  }
}

function setCustomRenderTarget(
  scene: Scene,
  target: RenderTargetTexture,
  active: boolean,
): void {
  const index = scene.customRenderTargets.indexOf(target);

  if (active) {
    if (index < 0) scene.customRenderTargets.push(target);
    return;
  }

  if (index >= 0) scene.customRenderTargets.splice(index, 1);
}

/** Rendering to a half-float target needs the float colour-buffer extension. */
function colorTextureType(scene: Scene): number {
  return scene.getEngine().getCaps().colorBufferFloat
    ? Constants.TEXTURETYPE_HALF_FLOAT
    : Constants.TEXTURETYPE_UNSIGNED_BYTE;
}

/**
 * R32F keeps depth precise enough for screen-space work. Without float render
 * support the pass degrades to an 8-bit normalised channel, which still
 * decodes to the same [0, 1] range.
 */
function depthTextureType(scene: Scene): number {
  return scene.getEngine().getCaps().colorBufferFloat
    ? Constants.TEXTURETYPE_FLOAT
    : Constants.TEXTURETYPE_UNSIGNED_BYTE;
}
