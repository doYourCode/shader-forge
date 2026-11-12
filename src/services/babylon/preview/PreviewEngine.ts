import { Engine, type Scene } from '@babylonjs/core';
import type { ShaderError } from '@/core/models/shaderError';
import {
  ShaderLogRecorder,
  type WebGlInfoLogContext,
} from '@/services/webgl/ShaderLogRecorder';
import { webGl2RequiredError } from './errors/shaderErrorFactory';

/** The only engine state the WebGL 2 guard needs, which keeps it testable. */
export interface WebGl2EngineLike {
  readonly webGLVersion: number;
}

export type WebGl2GuardResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: ShaderError };

/**
 * WebGL 2 is a hard requirement: the internal shaders are GLSL ES 3.00 and
 * Babylon only leaves those sources alone when it created a WebGL 2 context.
 * There is deliberately no WebGL 1 fallback.
 */
export function assertWebGl2(engine: WebGl2EngineLike): WebGl2GuardResult {
  if (engine.webGLVersion >= 2) {
    return { ok: true };
  }

  return { ok: false, error: webGl2RequiredError() };
}

/**
 * Owns the Babylon engine, the log recorder and the render loop. Everything
 * that touches the GL boundary lives here.
 */
export class PreviewEngine {
  private readonly reportError: (errors: ShaderError[]) => void;
  private engine: Engine | null = null;
  private logRecorder: ShaderLogRecorder | null = null;
  private scene: Scene | null = null;
  private renderLoopActive = false;

  constructor(reportError: (errors: ShaderError[]) => void) {
    this.reportError = reportError;
  }

  /** The recorder must be shared with the compiler for every compile. */
  get recorder(): ShaderLogRecorder | null {
    return this.logRecorder;
  }

  /**
   * Creates the engine and enforces WebGL 2. On failure the engine is disposed
   * and nulled, the error is reported once, and `null` is returned so `init`
   * can resolve without throwing.
   */
  create(canvas: HTMLCanvasElement): Engine | null {
    // `preserveDrawingBuffer` forces an extra copy of the drawing buffer on
    // every frame and is only needed to read the canvas back (screenshots).
    // The preview never does that, so it stays off.
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
    });
    this.engine = engine;

    const webGl2 = assertWebGl2(engine);
    if (!webGl2.ok) {
      engine.dispose();
      this.engine = null;
      this.reportError([webGl2.error]);
      return null;
    }

    this.logRecorder = createLogRecorder(engine);
    return engine;
  }

  /**
   * Registers the scene the render loop draws. Called as soon as the scene
   * exists, so a loop started by `setPaused(false)` during the mesh load still
   * clears the canvas exactly like the original manager.
   */
  attachScene(scene: Scene): void {
    this.scene = scene;
  }

  start(): void {
    this.runRenderLoop();
  }

  resize(): void {
    this.engine?.resize();
  }

  setPaused(on: boolean): void {
    if (!this.engine) return;

    if (on) {
      this.stopRenderLoop();
    } else {
      this.runRenderLoop();
    }
  }

  stopRenderLoop(): void {
    if (!this.engine) return;

    this.engine.stopRenderLoop();
    this.renderLoopActive = false;
  }

  dispose(): void {
    this.stopRenderLoop();
    this.logRecorder?.dispose();
    this.logRecorder = null;
    this.scene = null;
    this.engine?.dispose();
    this.engine = null;
  }

  /**
   * Registers the render callback at most once.
   *
   * Both `setPaused(false)` (called while the mesh loads, to clear the canvas
   * early) and `start()` (called once the scene is ready) land here. Registering
   * two closures would render the scene twice per frame, so the loop is
   * idempotent and `stopRenderLoop` clears the flag.
   */
  private runRenderLoop(): void {
    if (!this.engine || this.renderLoopActive) return;

    this.renderLoopActive = true;
    this.engine.runRenderLoop(() => {
      this.scene?.render();
    });
  }
}

/**
 * Babylon exposes the live WebGL context only through the private `_gl` field.
 * Isolated here (and in `EffectPipelineCache`) so an upgrade has one place to
 * fix. Instrumentation is optional: without a context, error reporting still
 * works through Babylon's fallback message.
 */
function createLogRecorder(engine: Engine): ShaderLogRecorder | null {
  const context = (engine as unknown as { _gl?: WebGlInfoLogContext })._gl;
  if (!context) return null;

  try {
    return new ShaderLogRecorder(context);
  } catch {
    return null;
  }
}
