import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Mesh,
  MeshBuilder,
  ShaderMaterial,
} from '@babylonjs/core';

export interface ShaderSource {
  vertex: string;
  fragment: string;
}

export interface CompileResult {
  ok: boolean;
  message: string;
}

export class SceneManager {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private material: ShaderMaterial | null = null;
  private mesh: Mesh | null = null;
  private wireframe = false;

  onError: (msg: string) => void = () => {};

  init(canvas: HTMLCanvasElement, source: ShaderSource): void {
    this.dispose();

    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.scene = new Scene(this.engine);

    const camera = new ArcRotateCamera(
      'camera',
      Math.PI / 2,
      Math.PI / 3,
      3.5,
      Vector3.Zero(),
      this.scene,
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 1.5;
    camera.upperRadiusLimit = 8;

    new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene);
    const dir = new DirectionalLight(
      'dir',
      new Vector3(-0.5, -1, -0.5),
      this.scene,
    );
    dir.intensity = 0.7;

    this.mesh = MeshBuilder.CreateSphere(
      'preview',
      { diameter: 2, segments: 32 },
      this.scene,
    );

    this.createMaterial(source);

    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });
  }

  private createMaterial(source: ShaderSource): void {
    if (!this.scene || !this.mesh) return;

    // Dispose the previous material (if any) so we don't leak GPU resources
    this.material?.dispose();

    this.material = new ShaderMaterial(
      'previewShader',
      this.scene,
      {
        vertexSource: source.vertex,
        fragmentSource: source.fragment,
      },
      {
        attributes: ['position', 'normal'],
        uniforms: ['worldViewProjection', 'normalMatrix'],
      },
    );

    this.material.wireframe = this.wireframe;

    this.material.onError = (_effect, errors) => {
      this.onError(errors);
    };

    this.mesh.material = this.material;
  }

  resize(): void {
    this.engine?.resize();
  }

  compile(source: ShaderSource): CompileResult {
    if (!this.scene || !this.mesh) {
      return { ok: false, message: 'Scene not initialized' };
    }

    try {
      this.createMaterial(source);
      return { ok: true, message: 'Compiled successfully' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.onError(msg);
      return { ok: false, message: msg };
    }
  }

  setWireframe(on: boolean): void {
    this.wireframe = on;
    if (!this.material) return;
    this.material.wireframe = on;
  }

  setPaused(on: boolean): void {
    if (!this.engine) return;
    if (on) {
      this.engine.stopRenderLoop();
    } else {
      this.engine.runRenderLoop(() => {
        this.scene?.render();
      });
    }
  }

  dispose(): void {
    this.engine?.stopRenderLoop();
    this.material?.dispose();
    this.scene?.dispose();
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
    this.material = null;
    this.mesh = null;
    this.wireframe = false;
  }
}