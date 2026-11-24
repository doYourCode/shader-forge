import { NullEngine, Scene } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';

import { FpsCameraController } from './FpsCameraController';

describe('FpsCameraController', () => {
  let engine: NullEngine | null = null;
  let scene: Scene | null = null;
  let controller: FpsCameraController | null = null;

  afterEach(() => {
    controller?.dispose();
    scene?.dispose();
    engine?.dispose();
  });

  it('installs WASD/QE navigation and pointer-lock-friendly controls', () => {
    engine = new NullEngine();
    scene = new Scene(engine);
    controller = new FpsCameraController(scene, { speed: 9 });

    expect(controller.camera.keysUp).toEqual([87]);
    expect(controller.camera.keysDown).toEqual([83]);
    expect(controller.camera.keysLeft).toEqual([65]);
    expect(controller.camera.keysRight).toEqual([68]);
    expect(controller.camera.keysUpward).toEqual([69]);
    expect(controller.camera.keysDownward).toEqual([81]);
    expect(controller.camera.speed).toBe(9);
    expect(controller.isPointerLocked).toBe(false);
  });

  it('frames a scene and resets to the framed view', () => {
    engine = new NullEngine();
    scene = new Scene(engine);
    controller = new FpsCameraController(scene);

    const framing = controller.frame(
      { x: -5, y: 0, z: -5 },
      { x: 5, y: 10, z: 5 },
    );

    expect(controller.camera.position.x).toBeCloseTo(framing.position.x);
    expect(controller.camera.position.y).toBeCloseTo(framing.position.y);
    expect(controller.camera.position.z).toBeCloseTo(framing.position.z);
    expect(controller.camera.minZ).toBe(framing.minZ);
    expect(controller.camera.maxZ).toBe(framing.maxZ);

    controller.camera.position.set(100, 100, 100);
    controller.reset();
    expect(controller.camera.position.x).toBeCloseTo(framing.position.x);
    expect(controller.camera.position.y).toBeCloseTo(framing.position.y);
    expect(controller.camera.position.z).toBeCloseTo(framing.position.z);
  });

  it('keeps the last camera when no bounds have been framed', () => {
    engine = new NullEngine();
    scene = new Scene(engine);
    controller = new FpsCameraController(scene);

    controller.camera.position.set(1, 2, 3);
    controller.reset();

    expect(controller.camera.position.asArray()).toEqual([1, 2, 3]);
  });
});
