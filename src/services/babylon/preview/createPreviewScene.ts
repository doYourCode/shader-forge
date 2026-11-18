import {
  ArcRotateCamera,
  Color4,
  DirectionalLight,
  HemisphericLight,
  Scene,
  Vector3,
  type Engine,
} from '@babylonjs/core';

export interface PreviewScene {
  scene: Scene;
  camera: ArcRotateCamera;
  directionalLight: DirectionalLight;
}

/**
 * Builds the preview scene exactly as the original manager did: fixed camera,
 * two lights, dark clear color. Returns the light explicitly instead of
 * capturing it in a closure.
 */
export function createPreviewScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
): PreviewScene {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString('#282c34ff');

  const camera = new ArcRotateCamera(
    'camera',
    Math.PI / 2,
    Math.PI / 3,
    3.5,
    Vector3.Zero(),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 2.5;
  camera.upperRadiusLimit = 5;
  camera.wheelDeltaPercentage = 0.01;
  // The preview only ever frames the loaded model. A tight clip range keeps
  // both the hardware depth buffer and the normalised depth pass precise;
  // Babylon's defaults (1 / 10 000) waste almost all of that precision.
  camera.minZ = 0.1;
  camera.maxZ = 20;
  scene.activeCamera = camera;

  new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  const directionalLight = new DirectionalLight(
    'dir',
    new Vector3(0.5, 1, 0.3),
    scene,
  );
  directionalLight.intensity = 0.7;

  return { scene, camera, directionalLight };
}
