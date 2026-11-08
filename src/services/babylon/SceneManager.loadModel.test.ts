import { describe, expect, it, vi } from 'vitest';
import type { Mesh } from '@babylonjs/core';

import {
  SceneManager,
  type PreviewMeshProviderFactory,
  type SceneManagerDeps,
} from './SceneManager';
import type { PreviewModel } from '@/core/models/previewModel';

const MODELS: readonly PreviewModel[] = [
  { id: 'first', label: 'First', url: '/first.glb' },
  { id: 'second', label: 'Second', url: '/second.glb' },
];

function createMesh(name: string) {
  return {
    name,
    rotationQuaternion: {},
    material: null,
    dispose: vi.fn(),
  };
}

function createHarness() {
  const first = createMesh('first');
  const second = createMesh('second');
  const pending = [first, second];

  const materials = {
    setWireframe: vi.fn(),
    prepareErrorMaterial: vi.fn(),
    apply: vi.fn(),
    buildMaterial: vi.fn(() => ({})),
    activeMaterial: null,
    setMesh: vi.fn(),
    dispose: vi.fn(),
    showError: vi.fn(),
  };
  const animator = {
    start: vi.fn(),
    dispose: vi.fn(),
    setMesh: vi.fn(),
  };
  const previewEngine = {
    create: vi.fn(() => ({})),
    attachScene: vi.fn(),
    start: vi.fn(),
    stopRenderLoop: vi.fn(),
    dispose: vi.fn(),
    recorder: null,
    setPaused: vi.fn(),
    resize: vi.fn(),
  };
  const environment = {
    load: vi.fn(async () => true),
    dispose: vi.fn(),
  };
  const deps = {
    createEngine: () => previewEngine,
    createScene: () => ({
      scene: {},
      camera: {},
      directionalLight: {},
    }),
    createMaterialController: () => materials,
    createAnimator: () => animator,
    createCompiler: () => ({}),
    createDiagnostics: () => ({}),
    createEnvironmentController: () => environment,
  } as unknown as SceneManagerDeps;

  const load = vi.fn(async () => pending.shift() as unknown as Mesh);
  const factory = vi.fn(() => ({ load })) as unknown as PreviewMeshProviderFactory;
  const manager = new SceneManager(factory, deps);

  return { manager, first, second, materials, animator, environment, load };
}

function init(manager: SceneManager): Promise<void> {
  return manager.init(
    {} as HTMLCanvasElement,
    { vertex: '', fragment: '' },
    MODELS[0]!,
  );
}

describe('SceneManager model swapping', () => {
  it('rebinds materials and animation to the new mesh', async () => {
    const harness = createHarness();
    await init(harness.manager);

    const swapped = await harness.manager.loadModel(MODELS[1]!);

    expect(swapped).toBe(true);
    expect(harness.load).toHaveBeenCalledTimes(2);
    expect(harness.materials.setMesh).toHaveBeenCalledWith(harness.second);
    expect(harness.animator.setMesh).toHaveBeenCalledWith(harness.second);
    expect(harness.first.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the current mesh when the new model fails to load', async () => {
    const harness = createHarness();
    await init(harness.manager);
    const errors: unknown[] = [];
    harness.manager.onError = (shaderErrors) => errors.push(shaderErrors);
    harness.load.mockRejectedValueOnce(new Error('missing model'));

    const swapped = await harness.manager.loadModel(MODELS[1]!);

    expect(swapped).toBe(false);
    expect(errors).toHaveLength(1);
    expect(harness.materials.setMesh).not.toHaveBeenCalled();
    expect(harness.first.dispose).not.toHaveBeenCalled();
  });
});
