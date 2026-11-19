import type { Mesh, Scene, ShaderMaterial } from '@babylonjs/core';
import { CreateScreenshotUsingRenderTargetAsync } from '@babylonjs/core/Misc/screenshotTools';

/** Upper bound for the shader warm-up; a broken effect must not hang a bake. */
const MAX_WARMUP_FRAMES = 120;

/**
 * The live pieces a snapshot needs, read lazily: a material or mesh can be
 * replaced (compile, model swap) between construction and capture.
 */
export interface PreviewSnapshotSource {
  readonly getScene: () => Scene | null;
  readonly getMesh: () => Mesh | null;
  readonly getMaterial: () => ShaderMaterial | null;
}

/** Renders the live preview to an image data URL. */
export interface PreviewSnapshot {
  capture(
    width: number,
    height: number,
    mimeType?: string,
  ): Promise<string | null>;
}

export type PreviewSnapshotFactory = (
  source: PreviewSnapshotSource,
) => PreviewSnapshot;

/**
 * Screenshot support for the example thumbnail baker (`npm run bake:examples`).
 *
 * It lives outside `SceneManager` on purpose: production never captures the
 * canvas, so the runtime facade does not carry bake-only code. The bake tool
 * injects this factory when it constructs the manager.
 *
 * The image therefore comes from the exact pipeline the editor renders instead
 * of a second Babylon setup that could drift.
 */
export const createRenderTargetSnapshot: PreviewSnapshotFactory = (source) => ({
  async capture(width, height, mimeType = 'image/webp') {
    const scene = source.getScene();
    const mesh = source.getMesh();
    const material = source.getMaterial();
    const camera = scene?.activeCamera ?? null;

    if (!scene || !mesh || !material || !camera) return null;

    // A screenshot taken before the effect compiled would capture the blank
    // scene (or the error material), which is worse than reporting no image.
    const ready = await waitForMaterial(material, mesh);
    if (!ready) return null;

    return CreateScreenshotUsingRenderTargetAsync(
      scene.getEngine(),
      camera,
      { width, height, precision: 1 },
      mimeType,
      4,
      true,
    );
  },
});

/**
 * Waits for the active effect to compile, resolving `false` when the warm-up
 * budget is exhausted. The render loop keeps drawing, but a screenshot taken
 * before the effect is ready would capture the blank scene.
 */
function waitForMaterial(
  material: ShaderMaterial,
  mesh: Mesh,
): Promise<boolean> {
  return new Promise((resolve) => {
    let frame = 0;

    const check = (): void => {
      if (material.isReady(mesh)) {
        resolve(true);
        return;
      }

      if (frame >= MAX_WARMUP_FRAMES) {
        resolve(false);
        return;
      }

      frame += 1;
      requestAnimationFrame(check);
    };

    check();
  });
}
