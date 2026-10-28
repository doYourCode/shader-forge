import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  ShaderMaterial,
} from '@babylonjs/core';

export interface CompileResult {
  ok: boolean;
  message: string;
}

export class SceneManager {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private material: ShaderMaterial | null = null;

  onError: (msg: string) => void = () => {};

  init(canvas: HTMLCanvasElement, source: { vertex: string; fragment: string }): void {
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

    const sphere = MeshBuilder.CreateSphere(
      'preview',
      { diameter: 2, segments: 32 },
      this.scene,
    );

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

    this.material.onError = (_effect, errors) => {
      this.onError(errors);
    };

    sphere.material = this.material;

    this.scene.onBeforeRenderObservable.add(() => {
      // reserved for future animation
    });

    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });
  }

  resize(): void {
    this.engine?.resize();
  }

  compile(source: { vertex: string; fragment: string }): CompileResult {
    if (!this.scene || !this.material) {
      return { ok: false, message: 'Scene not initialized' };
    }

    try {
      this.material.setVertexShaderCode(source.vertex);
      this.material.setFragmentShaderCode(source.fragment);
      return { ok: true, message: 'Compiled successfully' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.onError(msg);
      return { ok: false, message: msg };
    }
  }

  setWireframe(on: boolean): void {
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
    this.scene?.dispose();
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
    this.material = null;
  }
}