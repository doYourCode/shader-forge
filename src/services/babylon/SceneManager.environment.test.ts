import { describe, expect, it, vi } from 'vitest';
import type { Mesh } from '@babylonjs/core';

import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewModel } from '@/core/models/previewModel';
import {
  SceneManager,
  type PreviewMeshProviderFactory,
  type SceneManagerDeps,
} from './SceneManager';

const MODEL: PreviewModel = {
  id: 'model',
  label: 'Model',
  url: '/model.glb',
};

const STUDIO: PreviewHdri = {
  id: 'studio',
  label: 'Wooden Studio 17',
  url: '/studio.hdr',
};

const PEPPERMINT: PreviewHdri = {
  id: 'peppermint',
  label: 'Peppermint Powerplant',
  url: '/peppermint.hdr',
};

function createHarness() {
  const mesh = {
    name: '',
    rotationQuaternion: {},
    material: null,
    dispose: vi.fn(),
  } as unknown as Mesh;

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

  const createScene = vi.fn(() => ({
    scene: { dispose: vi.fn() },
    camera: {},
    directionalLight: {},
  }));
  const deps = {
    createEngine: () => previewEngine,
    createScene,
    createMaterialController: () => materials,
    createAnimator: () => animator,
    createCompiler: () => ({}),
    createDiagnostics: () => ({}),
    createEnvironmentController: () => environment,
  } as unknown as SceneManagerDeps;

  const factory = vi.fn(() => ({
    load: async () => mesh,
  })) as unknown as PreviewMeshProviderFactory;
  const manager = new SceneManager(factory, deps);

  return {
    manager,
    environment,
    createScene,
    materials,
  };
}

function init(manager: SceneManager): Promise<void> {
  return manager.init(
    {} as HTMLCanvasElement,
    { vertex: '', fragment: '' },
    MODEL,
    STUDIO,
  );
}

describe('SceneManager environment switching', () => {
  it('loads the requested HDRI while creating the scene', async () => {
    const harness = createHarness();

    await init(harness.manager);

    expect(harness.environment.load).toHaveBeenCalledWith(STUDIO);
  });

  it('delegates environment changes without rebuilding the preview', async () => {
    const harness = createHarness();
    await init(harness.manager);

    harness.environment.load.mockResolvedValueOnce(false);
    await expect(
      harness.manager.loadEnvironment(PEPPERMINT),
    ).resolves.toBe(false);
    expect(harness.environment.load).toHaveBeenLastCalledWith(PEPPERMINT);

    harness.environment.load.mockResolvedValueOnce(true);
    await expect(harness.manager.loadEnvironment(PEPPERMINT)).resolves.toBe(
      true,
    );
    expect(harness.createScene).toHaveBeenCalledTimes(1);
    expect(harness.materials.setMesh).not.toHaveBeenCalled();
  });

  it('disposes the environment controller with the scene', async () => {
    const harness = createHarness();
    await init(harness.manager);

    harness.manager.dispose();

    expect(harness.environment.dispose).toHaveBeenCalledTimes(1);
  });

  it('reports a failed environment load before initialization', async () => {
    const harness = createHarness();

    await expect(
      harness.manager.loadEnvironment(PEPPERMINT),
    ).resolves.toBe(false);
  });
});
