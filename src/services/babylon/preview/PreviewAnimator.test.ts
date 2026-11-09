import { describe, expect, it, vi } from 'vitest';
import {
  Matrix,
  type BaseTexture,
  type DirectionalLight,
  type Mesh,
  type Scene,
  type ShaderMaterial,
} from '@babylonjs/core';

import { SHADER_SAMPLER_NAMES } from './MaterialController';
import { PreviewAnimator } from './PreviewAnimator';

function createHarness() {
  const environment = {} as BaseTexture;
  const material = {
    setFloat: vi.fn(),
    setVector3: vi.fn(),
    setTexture: vi.fn(),
    setMatrix3x3: vi.fn(),
  };
  const mesh = {
    rotation: { y: 0 },
    computeWorldMatrix: vi.fn(),
    getWorldMatrix: () => Matrix.Identity(),
  } as unknown as Mesh;
  const scene = {
    environmentTexture: environment,
    activeCamera: { position: {} },
    onBeforeRenderObservable: {
      add: vi.fn(),
      remove: vi.fn(),
    },
  } as unknown as Scene;
  const light = { direction: {} } as unknown as DirectionalLight;
  const ibl = { bind: vi.fn(), dispose: vi.fn() };
  const animator = new PreviewAnimator(
    scene,
    light,
    mesh,
    () => material as unknown as ShaderMaterial,
    ibl,
  );

  return { animator, scene, material, environment, ibl };
}

function triggerRender(scene: Scene): void {
  const add = scene.onBeforeRenderObservable.add as unknown as {
    mock: { calls: Array<[() => void]> };
  };
  add.mock.calls[0]![0]();
}

describe('PreviewAnimator', () => {
  it('binds the active scene environment to the shader sampler', () => {
    const harness = createHarness();

    harness.animator.start();
    triggerRender(harness.scene);

    expect(harness.material.setTexture).toHaveBeenCalledWith(
      SHADER_SAMPLER_NAMES.environment,
      harness.environment,
    );
  });

  it('follows environment texture changes on the next frame', () => {
    const harness = createHarness();
    harness.animator.start();

    const replacement = {} as BaseTexture;
    (harness.scene as unknown as { environmentTexture: BaseTexture })
      .environmentTexture = replacement;
    triggerRender(harness.scene);

    expect(harness.material.setTexture).toHaveBeenLastCalledWith(
      SHADER_SAMPLER_NAMES.environment,
      replacement,
    );
  });

  it('rebinds the IBL resources on every frame', () => {
    const harness = createHarness();
    harness.animator.start();
    triggerRender(harness.scene);
    triggerRender(harness.scene);

    expect(harness.ibl.bind).toHaveBeenCalledTimes(2);
    expect(harness.ibl.bind).toHaveBeenLastCalledWith(
      harness.material as unknown as ShaderMaterial,
    );
  });

  it('disposes the IBL binder with the animator', () => {
    const harness = createHarness();
    harness.animator.start();

    harness.animator.dispose();

    expect(harness.ibl.dispose).toHaveBeenCalledTimes(1);
  });
});
