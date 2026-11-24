import { UniversalCamera, Vector3, type Scene } from '@babylonjs/core';
import {
  computeSceneFraming,
  type SceneFraming,
  type Vec3Like,
} from '@/core/screenspace/sceneClassification';

export interface FpsCameraOptions {
  readonly name?: string;
  /** Speed in world units per second. */
  readonly speed?: number;
  readonly angularSensibility?: number;
  readonly inertia?: number;
  /** When supplied, the camera installs WASD/mouse controls immediately. */
  readonly canvas?: HTMLCanvasElement;
}

/**
 * First-person navigation for a whole scene.
 *
 * WASD moves, Q/E descend/ascend, the mouse aims. Clicking the canvas requests
 * pointer lock; without lock, Babylon's default drag-to-look still works.
 */
export class FpsCameraController {
  readonly camera: UniversalCamera;

  private canvas: HTMLCanvasElement | null = null;
  private framing: SceneFraming | null = null;
  private disposed = false;
  private readonly baseSpeed: number;
  private readonly onClick = (): void => this.requestPointerLock();
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Shift') this.camera.speed = this.baseSpeed * 3;
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === 'Shift') this.camera.speed = this.baseSpeed;
  };

  constructor(scene: Scene, options: FpsCameraOptions = {}) {
    this.camera = new UniversalCamera(
      options.name ?? 'sf-screen-space-camera',
      new Vector3(0, 1.7, 0),
      scene,
    );

    this.baseSpeed = options.speed ?? 10;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1000;
    this.camera.speed = this.baseSpeed;
    this.camera.inertia = options.inertia ?? 0.7;
    this.camera.angularSensibility = options.angularSensibility ?? 1400;
    this.camera.keysUp = [87]; // W
    this.camera.keysDown = [83]; // S
    this.camera.keysLeft = [65]; // A
    this.camera.keysRight = [68]; // D
    this.camera.keysUpward = [69]; // E
    this.camera.keysDownward = [81]; // Q
    this.camera.checkCollisions = false;
    this.camera.applyGravity = false;

    if (options.canvas) this.attach(options.canvas);
  }

  /** Starts listening for keyboard/mouse input and pointer lock requests. */
  attach(canvas: HTMLCanvasElement): void {
    if (this.disposed) return;

    this.detach();
    this.canvas = canvas;
    this.camera.attachControl(canvas, true);
    canvas.addEventListener('click', this.onClick);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
    }
  }

  detach(): void {
    this.canvas?.removeEventListener('click', this.onClick);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
    }
    this.canvas = null;
    this.camera.detachControl();
  }

  /** Frames world bounds and resets the view to that framing. */
  frame(min: Vec3Like, max: Vec3Like): SceneFraming {
    const framing = computeSceneFraming(min, max);
    this.framing = framing;
    this.reset();

    return framing;
  }

  /** Restores the last framed view. */
  reset(): void {
    const framing = this.framing;
    if (!framing) return;

    this.camera.position.set(
      framing.position.x,
      framing.position.y,
      framing.position.z,
    );
    this.camera.setTarget(
      new Vector3(framing.center.x, framing.center.y, framing.center.z),
    );
    this.camera.minZ = framing.minZ;
    this.camera.maxZ = framing.maxZ;
  }

  get isPointerLocked(): boolean {
    const engine = this.camera.getScene().getEngine() as unknown as {
      isPointerLock: boolean;
    };
    return engine.isPointerLock;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.detach();
    this.camera.dispose();
  }

  private requestPointerLock(): void {
    if (this.disposed) return;

    const engine = this.camera.getScene().getEngine() as unknown as {
      isPointerLock: boolean;
      enterPointerlock?: () => void;
    };
    if (engine.isPointerLock) return;

    try {
      engine.enterPointerlock?.();
    } catch {
      // Pointer lock needs a user gesture (and is unavailable in some
      // embedded contexts); drag-to-look remains usable.
    }
  }
}
