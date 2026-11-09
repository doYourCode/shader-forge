import { describe, expect, it, vi } from 'vitest';
import type { Mesh } from '@babylonjs/core';

import type { PreviewModel } from '@/core/models/previewModel';
import type { UserDataController } from '@/services/userdata/UserDataController';
import {
  SceneManager,
  type PreviewMeshProviderFactory,
  type SceneManagerDeps,
} from './SceneManager';
import type { MaterialBlueprint } from './preview/PreviewTypes';

const MODEL: PreviewModel = {
  id: 'model',
  label: 'Model',
  url: '/model.glb',
};

const BLUEPRINT: MaterialBlueprint = {
  vertex: '#version 300 es\nvoid main() {}',
  fragment: '#version 300 es\nvoid main() {}',
  extraUniforms: ['tint'],
  extraSamplers: [],
};

function createHarness() {
  const mesh = {
    name: '',
    rotationQuaternion: {},
    material: null,
    dispose: vi.fn(),
  } as unknown as Mesh;

  const materials: Record<string, unknown> = {
    setWireframe: vi.fn(),
    prepareErrorMaterial: vi.fn(),
    buildMaterial: vi.fn(() => ({ id: 'built-material' })),
    activeMaterial: null,
    setMesh: vi.fn(),
    dispose: vi.fn(),
    showError: vi.fn(),
  };
  materials.apply = vi.fn((material: unknown) => {
    materials.activeMaterial = material;
  });

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
  const textures = {
    load: vi.fn(async () => null),
    release: vi.fn(),
    textureFor: vi.fn(() => null),
    dispose: vi.fn(),
  };
  const binder = { attach: vi.fn(), apply: vi.fn(), applyAll: vi.fn() };
  const bindingTarget = { setFloat: vi.fn() };

  const attempt = {
    ok: true,
    material: { id: 'compiled-material' },
    errors: [],
    stage: null,
    release: vi.fn(),
  };
  const compiler = { tryCompile: vi.fn(async () => attempt) };
  const diagnostics = { collect: vi.fn(async () => []) };

  const createUniformBindingTarget = vi.fn(() => bindingTarget);
  const deps = {
    createEngine: () => previewEngine,
    createScene: () => ({
      scene: { dispose: vi.fn() },
      camera: {},
      directionalLight: {},
    }),
    createMaterialController: () => materials,
    createAnimator: () => animator,
    createCompiler: () => compiler,
    createDiagnostics: () => diagnostics,
    createEnvironmentController: () => environment,
    createTextureRegistry: () => textures,
    createUniformBinder: () => binder,
    createUniformBindingTarget,
  } as unknown as SceneManagerDeps;

  const factory = vi.fn(() => ({ load: async () => mesh }));
  const manager = new SceneManager(
    factory as unknown as PreviewMeshProviderFactory,
    deps,
  );

  const userData = {
    attachGpu: vi.fn(),
    onMaterialApplied: vi.fn(),
  } as unknown as UserDataController;

  return {
    manager,
    userData,
    materials,
    textures,
    binder,
    bindingTarget,
    createUniformBindingTarget,
  };
}

function init(
  harness: ReturnType<typeof createHarness>,
): Promise<void> {
  return harness.manager.init(
    {} as HTMLCanvasElement,
    BLUEPRINT,
    MODEL,
    undefined,
    harness.userData,
  );
}

describe('SceneManager user data binding', () => {
  it('attaches the scene GPU ports before the material is applied', async () => {
    const harness = createHarness();

    await init(harness);

    expect(harness.userData.attachGpu).toHaveBeenCalledWith({
      textures: harness.textures,
      binder: harness.binder,
    });
    expect(harness.createUniformBindingTarget).toHaveBeenCalledWith({
      id: 'built-material',
    });
    expect(harness.userData.onMaterialApplied).toHaveBeenCalledWith(
      harness.bindingTarget,
    );
  });

  it('re-attaches the binder after every successful compile', async () => {
    const harness = createHarness();
    await init(harness);
    vi.mocked(harness.userData.onMaterialApplied).mockClear();
    harness.createUniformBindingTarget.mockClear();

    const result = await harness.manager.compile(BLUEPRINT);

    expect(result.ok).toBe(true);
    expect(harness.createUniformBindingTarget).toHaveBeenCalledWith({
      id: 'compiled-material',
    });
    expect(harness.userData.onMaterialApplied).toHaveBeenCalledWith(
      harness.bindingTarget,
    );
  });

  it('detaches the controller and disposes the texture registry', async () => {
    const harness = createHarness();
    await init(harness);

    harness.manager.dispose();

    expect(harness.userData.attachGpu).toHaveBeenLastCalledWith(null);
    expect(harness.textures.dispose).toHaveBeenCalledTimes(1);
  });
});
