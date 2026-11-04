import type {
  AbstractMesh,
  Scene,
  ShaderMaterial,
} from '@babylonjs/core';
import { parseShaderCompileErrors } from '@/core/utils/shaderErrors';
import type { ShaderLogRecorder } from '@/services/webgl/ShaderLogRecorder';
import { buildShaderMaterial } from '../MaterialController';
import type { ShaderSource } from '../PreviewTypes';
import {
  internalError,
  internalErrorFrom,
  timeoutError,
} from '../errors/shaderErrorFactory';
import { CompileAttempt } from './CompileAttempt';

export interface ShaderCompilerOptions {
  timeoutMs: number;
  pollMs: number;
}

const DEFAULT_COMPILER_OPTIONS: ShaderCompilerOptions = {
  timeoutMs: 15_000,
  pollMs: 32,
};

interface AttemptSettler {
  finish(attempt: CompileAttempt): void;
  isSettled(): boolean;
  schedule(callback: () => void, delayMs: number): void;
  clearTimer(): void;
}

/**
 * Compiles a user shader into a material and resolves with a `CompileAttempt`
 * that owns the material/effect. Knows nothing about the preview facade.
 */
export class ShaderCompiler {
  private readonly scene: Scene;
  private readonly logRecorder: ShaderLogRecorder | null;
  private readonly options: ShaderCompilerOptions;

  constructor(
    scene: Scene,
    logRecorder: ShaderLogRecorder | null = null,
    options: ShaderCompilerOptions = DEFAULT_COMPILER_OPTIONS,
  ) {
    this.scene = scene;
    this.logRecorder = logRecorder;
    this.options = options;
  }

  tryCompile(
    source: ShaderSource,
    mesh: AbstractMesh | null,
    name = 'previewShader',
  ): Promise<CompileAttempt> {
    return new Promise((resolve) => {
      if (!mesh || this.scene.isDisposed) {
        resolve(
          new CompileAttempt(
            false,
            [internalError('Scene not initialized')],
            'program',
            null,
            null,
          ),
        );
        return;
      }

      const built = this.buildMaterialSafely(source, name);
      if (built instanceof CompileAttempt) {
        resolve(built);
        return;
      }

      const material = built;
      const settler = this.createSettler(resolve);

      material.onCompiled = (effect) => {
        settler.finish(new CompileAttempt(true, [], null, material, effect));
      };

      material.onError = (failedEffect, rawErrors) => {
        const records = this.logRecorder?.drain() ?? [];
        const errors = parseShaderCompileErrors(records, source, rawErrors);

        settler.finish(
          new CompileAttempt(
            false,
            errors,
            errors[0]?.stage ?? null,
            material,
            failedEffect,
          ),
        );
      };

      const started = performance.now();

      const poll = () => {
        settler.clearTimer();
        if (settler.isSettled()) return;

        if (performance.now() - started > this.options.timeoutMs) {
          settler.finish(
            new CompileAttempt(
              false,
              [timeoutError(this.options.timeoutMs)],
              'program',
              material,
              material.getEffect(),
            ),
          );
          return;
        }

        const attempt = this.checkReady(material, mesh);
        if (attempt) {
          settler.finish(attempt);
          return;
        }

        settler.schedule(poll, this.options.pollMs);
      };

      settler.schedule(poll, this.options.pollMs);

      // The synchronous check runs after the timer is scheduled, so a shader
      // that is already ready still resolves on this tick.
      const immediate = this.checkReady(material, mesh);
      if (immediate) {
        settler.finish(immediate);
      }
    });
  }

  /**
   * Builds the material for one attempt. The recorder starts a new batch before
   * the build so a throwing build still leaves an empty batch behind.
   */
  private buildMaterialSafely(
    source: ShaderSource,
    name: string,
  ): ShaderMaterial | CompileAttempt {
    try {
      this.logRecorder?.begin();
      return buildShaderMaterial(this.scene, source, name);
    } catch (error) {
      return new CompileAttempt(
        false,
        [internalErrorFrom(error)],
        'program',
        null,
        null,
      );
    }
  }

  /** Reads `isReady` once, collapsing the three former try/catch blocks. */
  private checkReady(
    material: ShaderMaterial,
    mesh: AbstractMesh | null,
  ): CompileAttempt | null {
    let ready = false;
    try {
      ready = material.isReady(mesh ?? undefined);
    } catch (error) {
      return new CompileAttempt(
        false,
        [internalErrorFrom(error)],
        'program',
        material,
        material.getEffect(),
      );
    }

    if (!ready) return null;

    return new CompileAttempt(true, [], null, material, material.getEffect());
  }

  /** Settle-once wrapper that also owns the polling timer. */
  private createSettler(
    resolve: (attempt: CompileAttempt) => void,
  ): AttemptSettler {
    let settled = false;
    let timer: number | undefined;

    const clearTimer = () => {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
    };

    const finish = (attempt: CompileAttempt) => {
      if (settled) return;
      settled = true;
      clearTimer();
      resolve(attempt);
    };

    const schedule = (callback: () => void, delayMs: number) => {
      timer = window.setTimeout(callback, delayMs);
    };

    return {
      finish,
      isSettled: () => settled,
      schedule,
      clearTimer,
    };
  }
}
