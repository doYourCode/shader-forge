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
  Color4,
  type Effect,
} from '@babylonjs/core';
import type { ShaderError, ShaderErrorStage } from '@/core/models/shaderError';
import { parseShaderCompileErrors } from '@/core/utils/shaderErrors';
import { getStateObject } from '@babylonjs/core/Engines/thinEngine.functions';

export interface ShaderSource {
  vertex: string;
  fragment: string;
}

export interface CompileResult {
  ok: boolean;
  message: string;
  errors: ShaderError[];
}

interface CompileAttempt {
  ok: boolean;
  errors: ShaderError[];
  stage: ShaderErrorStage | null;
  material: ShaderMaterial | null;
  effect: Effect | null;
}

const SHADER_ATTRIBUTES = ['position', 'normal'];
const SHADER_UNIFORMS = ['worldViewProjection', 'normalMatrix'];
const COMPILE_TIMEOUT_MS = 15_000;
const ERROR_PREWARM_FRAMES = 120;

const ERROR_VERTEX_SHADER = `
precision highp float;

attribute vec3 position;

uniform mat4 worldViewProjection;

void main(void) {
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`.trim();

const ERROR_FRAGMENT_SHADER = `
precision highp float;

void main(void) {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`.trim();

/**
 * A known-good vertex shader used to validate the fragment stage on its own
 * when the real vertex shader fails to compile.
 */
const VALIDATION_VERTEX_SHADER = `
precision highp float;

attribute vec3 position;
attribute vec3 normal;

uniform mat4 worldViewProjection;
uniform mat4 normalMatrix;

varying vec3 vNormal;

void main(void) {
  gl_Position = worldViewProjection * vec4(position, 1.0);
  vNormal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
}
`.trim();

export class SceneManager {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private material: ShaderMaterial | null = null;
  private errorMaterial: ShaderMaterial | null = null;
  private mesh: Mesh | null = null;
  private wireframe = false;
  private disposed = false;
  private errorPrewarmFrame: number | null = null;

  onError: (msg: string) => void = () => {};

  init(canvas: HTMLCanvasElement, source: ShaderSource): void {
    this.dispose();
    this.disposed = false;

    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = Color4.FromHexString('#282c34ff');

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

    this.prepareErrorMaterial();

    const material = this.buildMaterial(source);
    material.onError = (_effect, errors) => {
      this.showErrorMaterial();
      this.onError(errors);
    };
    this.material = material;
    this.mesh.material = material;

    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });
  }

  private buildMaterial(
    source: ShaderSource,
    name = 'previewShader',
  ): ShaderMaterial {
    if (!this.scene) {
      throw new Error('Scene not initialized');
    }

    const material = new ShaderMaterial(
      name,
      this.scene,
      {
        vertexSource: source.vertex,
        fragmentSource: source.fragment,
      },
      {
        attributes: [...SHADER_ATTRIBUTES],
        uniforms: [...SHADER_UNIFORMS],
      },
      // Keep the effect on the material so disposing a rejected compile also
      // releases the effect instead of leaving it in Babylon's shader cache.
      false,
    );

    material.wireframe = this.wireframe;
    return material;
  }

  /**
   * Creates and compiles the error material ahead of time so showing it after a
   * failed compile is instantaneous.
   */
  private prepareErrorMaterial(): void {
    const material = this.ensureErrorMaterial();
    if (!material || !this.mesh || this.errorPrewarmFrame !== null) return;

    let frames = 0;
    const warm = () => {
      this.errorPrewarmFrame = null;
      if (this.disposed || !this.mesh || !this.errorMaterial) return;

      if (this.errorMaterial.isReady(this.mesh)) return;
      if (frames++ >= ERROR_PREWARM_FRAMES) return;

      this.errorPrewarmFrame = requestAnimationFrame(warm);
    };

    this.errorPrewarmFrame = requestAnimationFrame(warm);
  }

  private ensureErrorMaterial(): ShaderMaterial | null {
    if (!this.scene) return null;

    if (!this.errorMaterial) {
      this.errorMaterial = new ShaderMaterial(
        'previewErrorShader',
        this.scene,
        {
          vertexSource: ERROR_VERTEX_SHADER,
          fragmentSource: ERROR_FRAGMENT_SHADER,
        },
        {
          attributes: ['position'],
          uniforms: ['worldViewProjection'],
        },
        false,
      );
      this.errorMaterial.wireframe = this.wireframe;
    }

    return this.errorMaterial;
  }

  private showErrorMaterial(): void {
    if (!this.mesh) return;

    const material = this.ensureErrorMaterial();
    if (!material) return;

    material.wireframe = this.wireframe;
    this.mesh.material = material;
  }

  private applyMaterial(material: ShaderMaterial): void {
    if (!this.mesh) {
      material.dispose();
      return;
    }

    const previous = this.material;

    material.wireframe = this.wireframe;
    material.onError = (_effect, errors) => {
      this.showErrorMaterial();
      this.onError(errors);
    };

    this.material = material;
    this.mesh.material = material;
    previous?.dispose();
  }

  resize(): void {
    this.engine?.resize();
  }

  async compile(source: ShaderSource): Promise<CompileResult> {
    if (!this.scene || !this.mesh || this.disposed) {
      return { ok: false, message: 'Scene not initialized', errors: [] };
    }

    const attempt = await this.tryCompile(source);

    if (this.disposed) {
      releaseAttempt(attempt, true);
      return { ok: false, message: 'Scene disposed', errors: [] };
    }

    if (attempt.ok && attempt.material) {
      this.applyMaterial(attempt.material);
      return { ok: true, message: 'Compiled successfully', errors: [] };
    }

    releaseAttempt(attempt, true);

    let errors = attempt.errors;
    const message =
      errors.length > 0
        ? 'Shader compilation failed'
        : 'Shader program failed to link';

    // Babylon stops at the first failing stage. If the vertex shader failed,
    // compile the fragment shader on its own so both stages can be reported.
    if (attempt.stage === 'vertex') {
      const fragmentAttempt = await this.tryCompile({
        vertex: VALIDATION_VERTEX_SHADER,
        fragment: source.fragment,
      });
      releaseAttempt(fragmentAttempt, !fragmentAttempt.ok);

      if (!fragmentAttempt.ok) {
        const fragmentErrors = fragmentAttempt.errors.filter(
          (error) => error.stage === 'fragment',
        );
        if (fragmentErrors.length > 0) {
          errors = [...errors, ...fragmentErrors];
        }
      }
    }

    this.showErrorMaterial();

    return { ok: false, message, errors };
  }

  private tryCompile(
    source: ShaderSource,
    name = 'previewShader',
  ): Promise<CompileAttempt> {
    return new Promise((resolve) => {
      if (!this.scene || !this.mesh || this.disposed) {
        resolve({
          ok: false,
          errors: [
            {
              stage: 'program',
              line: null,
              column: null,
              message: 'Scene not initialized',
            },
          ],
          stage: 'program',
          material: null,
          effect: null,
        });
        return;
      }

      let material: ShaderMaterial;
      try {
        material = this.buildMaterial(source, name);
      } catch (error) {
        resolve({
          ok: false,
          errors: [
            {
              stage: 'program',
              line: null,
              column: null,
              message: error instanceof Error ? error.message : String(error),
            },
          ],
          stage: 'program',
          material: null,
          effect: null,
        });
        return;
      }

      let settled = false;
      let timer: number | undefined;

      const finish = (attempt: CompileAttempt) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
        }
        resolve(attempt);
      };

      material.onCompiled = (effect) => {
        finish({ ok: true, errors: [], stage: null, material, effect });
      };

      material.onError = (effect, rawErrors) => {
        const errors = parseShaderCompileErrors(
          rawErrors,
          source,
          {
            vertex: effect.vertexSourceCode,
            fragment: effect.fragmentSourceCode,
          },
          getDriverLineOffset(effect),
        );

        finish({
          ok: false,
          errors,
          stage: errors[0]?.stage ?? null,
          material,
          effect,
        });
      };

      const started = performance.now();
      const poll = () => {
        timer = undefined;
        if (settled) return;

        if (performance.now() - started > COMPILE_TIMEOUT_MS) {
          finish({
            ok: false,
            errors: [
              {
                stage: 'program',
                line: null,
                column: null,
                message: 'Shader compilation timed out',
              },
            ],
            stage: 'program',
            material,
            effect: material.getEffect(),
          });
          return;
        }

        let ready = false;
        try {
          ready = material.isReady(this.mesh ?? undefined);
        } catch (error) {
          finish({
            ok: false,
            errors: [
              {
                stage: 'program',
                line: null,
                column: null,
                message:
                  error instanceof Error ? error.message : String(error),
              },
            ],
            stage: 'program',
            material,
            effect: material.getEffect(),
          });
          return;
        }

        if (ready) {
          finish({
            ok: true,
            errors: [],
            stage: null,
            material,
            effect: material.getEffect(),
          });
          return;
        }

        timer = window.setTimeout(poll, 32);
      };

      // The callbacks normally settle the promise. The poll is a safety net for
      // drivers that report compilation status without invoking them.
      timer = window.setTimeout(poll, 32);

      try {
        if (material.isReady(this.mesh)) {
          finish({
            ok: true,
            errors: [],
            stage: null,
            material,
            effect: material.getEffect(),
          });
        }
      } catch (error) {
        finish({
          ok: false,
          errors: [
            {
              stage: 'program',
              line: null,
              column: null,
              message: error instanceof Error ? error.message : String(error),
            },
          ],
          stage: 'program',
          material,
          effect: material.getEffect(),
        });
      }
    });
  }

  setWireframe(on: boolean): void {
    this.wireframe = on;
    if (this.material) {
      this.material.wireframe = on;
    }
    if (this.errorMaterial) {
      this.errorMaterial.wireframe = on;
    }
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
    this.disposed = true;

    if (this.errorPrewarmFrame !== null) {
      cancelAnimationFrame(this.errorPrewarmFrame);
      this.errorPrewarmFrame = null;
    }

    this.engine?.stopRenderLoop();
    this.material?.dispose();
    this.errorMaterial?.dispose();
    this.scene?.dispose();
    this.engine?.dispose();
    this.scene = null;
    this.engine = null;
    this.material = null;
    this.errorMaterial = null;
    this.mesh = null;
    this.wireframe = false;
  }
}

/**
 * Babylon prepends `#version`/`#define WEBGL2` and the effect defines when it
 * hands the source to the driver, but `effect.*SourceCode` excludes them.
 * Driver-reported line numbers include those lines, so account for them when
 * mapping back to the editor document.
 */
function getDriverLineOffset(effect: Effect): number {
  const versionLines =
    effect.getEngine().shaderPlatformName === 'WEBGL2' ? 2 : 0;
  const defineLines = effect.defines ? effect.defines.split('\n').length : 0;

  return versionLines + defineLines;
}

/**
 * Releases a compile attempt that will not be applied to the mesh. Babylon's
 * shader cache can otherwise keep a failed program around, and a later attempt
 * with the same source would reuse it instead of recompiling.
 */
function releaseAttempt(
  attempt: CompileAttempt,
  failed: boolean,
): void {
  if (failed) {
    clearCachedPipeline(attempt.effect);
  }

  const effect = attempt.effect;
  const attached = attempt.material?.getEffect() === effect;

  attempt.material?.dispose();
  if (!attached) {
    effect?.dispose();
  }
}

/**
 * When WebGL compiles a program synchronously, Babylon caches the pipeline
 * before it knows compilation failed. The error path never assigns that
 * pipeline to the effect, so `Effect.dispose()` cannot evict it and a later
 * compile of the same broken source would be treated as already ready.
 * Remove the failed pipeline from the engine cache explicitly.
 */
function clearCachedPipeline(effect: Effect | null): void {
  if (!effect) return;

  const engine = effect.getEngine() as unknown as {
    _gl?: WebGL2RenderingContext;
  };
  const context = engine._gl;
  if (!context) return;

  const state = getStateObject(context);
  const pipelineName = effect.key.replace(/\r/g, '').replace(/\n/g, '|');
  const pipeline = state.cachedPipelines[pipelineName];

  if (!pipeline) return;

  pipeline.dispose();
  delete state.cachedPipelines[pipelineName];
}
