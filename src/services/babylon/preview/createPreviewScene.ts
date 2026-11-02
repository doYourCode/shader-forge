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
  camera.lowerRadiusLimit = 2.0;
  camera.upperRadiusLimit = 6;
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
