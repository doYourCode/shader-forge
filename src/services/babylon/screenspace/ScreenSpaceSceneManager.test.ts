import {
  NullEngine,
  Scene,
  Vector3,
  type BaseTexture,
  type Engine,
  type UniversalCamera,
} from '@babylonjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { PostEffectStack } from '@/core/models/postEffect';
import type { UserDataController } from '@/services/userdata/UserDataController';
import {
  ScreenSpaceSceneManager,
  takeFrameDrawCalls,
} from './ScreenSpaceSceneManager';
import type { FpsCameraController } from './FpsCameraController';
import type { SceneAssetProvider } from './SceneAssetProvider';
import type { ScreenSpaceGbuffer } from './ScreenSpaceGbuffer';
import type { ScreenSpacePostPipeline } from './ScreenSpacePostPipeline';
import type { EnvironmentController } from '../preview/EnvironmentController';

const STACK: PostEffectStack = { effects: [], tonemap: 'aces' };

function fakeMesh() {
  return {
    getTotalVertices: () => 3,
    computeWorldMatrix: () => {},
    getBoundingInfo: () => ({
      boundingBox: {
        minimumWorld: new Vector3(-1, -1, -1),
        maximumWorld: new Vector3(1, 1, 1),
      },
    }),
  };
}

describe('ScreenSpaceSceneManager', () => {
  it('loads a scene, installs the pipeline and disposes every owner', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);

    const camera = {
      camera: {
        layerMask: 0,
        minZ: 0.1,
        maxZ: 100,
      } as unknown as UniversalCamera,
      frame: vi.fn(),
      dispose: vi.fn(),
    } as unknown as FpsCameraController;

    const environment = {
      load: vi.fn(() => Promise.resolve(true)),
      dispose: vi.fn(),
    } as unknown as EnvironmentController;

    const container = {
      dispose: vi.fn(),
    };
    const meshProvider = {
      load: vi.fn(() => Promise.resolve(container)),
      prepare: vi.fn(() => ({
        opaque: [fakeMesh()],
        transparent: [],
        ignored: [],
      })),
    } as unknown as SceneAssetProvider;

    const gbuffer = {
      supported: true,
      setMeshes: vi.fn(),
      refreshPrePass: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
    } as unknown as ScreenSpaceGbuffer;

    const pipeline = {
      compile: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
      setTonemap: vi.fn(),
      setDebugMode: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
    } as unknown as ScreenSpacePostPipeline;

    const previewEngine = {
      create: vi.fn(() => engine as unknown as Engine),
      attachScene: vi.fn(),
      start: vi.fn(),
      stopRenderLoop: vi.fn(),
      setPaused: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
      recorder: null,
    };

    const userData = {
      attachGpu: vi.fn(),
      postBindings: vi.fn(() => []),
    } as unknown as UserDataController<BaseTexture>;

    const sun = { bind: vi.fn(), setIntensity: vi.fn(), dispose: vi.fn() };
    const createSun = vi.fn(() => sun);

    const manager = new ScreenSpaceSceneManager(
      {
        createEngine: () => previewEngine as never,
        createScene: () => ({ scene, camera }),
        createEnvironment: () => environment,
        createSun,
        createGbuffer: () => gbuffer,
        createPipeline: () => pipeline,
      },
      meshProvider,
    );

    const errors: unknown[] = [];
    manager.onError = (next) => errors.push(next);

    await manager.init(
      {} as HTMLCanvasElement,
      {
        id: 'test',
        label: 'Test',
        url: 'scenes/bistro_compressed.glb',
      },
      {
        id: 'hdri',
        label: 'HDRI',
        url: 'hdri/env/wooden-studio-17.env',
        format: 'env',
      },
      STACK,
      userData,
    );

    expect(errors).toEqual([]);
    expect(environment.load).toHaveBeenCalled();
    expect(meshProvider.load).toHaveBeenCalled();
    expect(camera.frame).toHaveBeenCalled();
    expect(gbuffer.refreshPrePass).not.toHaveBeenCalled();
    expect(pipeline.compile).toHaveBeenCalledWith(STACK);
    expect(previewEngine.start).toHaveBeenCalled();
    expect(userData.attachGpu).toHaveBeenCalled();

    // The sun exists before the meshes load so their PBR effects include it.
    expect(createSun).toHaveBeenCalledWith(scene, camera.camera, 2);
    expect(sun.bind).toHaveBeenCalledWith(
      expect.objectContaining({ opaque: expect.any(Array) }),
    );

    manager.setSunIntensity(3.5);
    expect(sun.setIntensity).toHaveBeenCalledWith(3.5);

    manager.setEnvironmentIntensity(1.4);
    expect(scene.environmentIntensity).toBe(1.4);

    manager.dispose();

    expect(userData.attachGpu).toHaveBeenCalledWith(null);
    expect(pipeline.dispose).toHaveBeenCalled();
    expect(gbuffer.dispose).toHaveBeenCalled();
    expect(environment.dispose).toHaveBeenCalled();
    expect(sun.dispose).toHaveBeenCalled();
    expect(container.dispose).toHaveBeenCalled();
    expect(camera.dispose).toHaveBeenCalled();
    expect(previewEngine.stopRenderLoop).toHaveBeenCalled();
    expect(previewEngine.dispose).toHaveBeenCalled();
    expect(scene.isDisposed).toBe(true);
  });

  it('reports a failed effect compile and installs a display fallback', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const camera = {
      camera: {} as UniversalCamera,
      frame: vi.fn(),
      dispose: vi.fn(),
    } as unknown as FpsCameraController;
    const environment = {
      load: vi.fn(() => Promise.resolve(true)),
      dispose: vi.fn(),
    } as unknown as EnvironmentController;
    const container = { dispose: vi.fn() };
    const meshProvider = {
      load: vi.fn(() => Promise.resolve(container)),
      prepare: vi.fn(() => ({
        opaque: [fakeMesh()],
        transparent: [],
        ignored: [],
      })),
    } as unknown as SceneAssetProvider;
    const gbuffer = {
      supported: true,
      setMeshes: vi.fn(),
      refreshPrePass: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
    } as unknown as ScreenSpaceGbuffer;

    const compile = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'failed',
        errors: [
          {
            stage: 'post',
            line: 1,
            column: 1,
            kind: 'syntax',
            title: 'bad',
            message: 'bad',
          },
        ],
      })
      .mockResolvedValueOnce({ status: 'ok' });

    const pipeline = {
      compile,
      setTonemap: vi.fn(),
      setDebugMode: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
    } as unknown as ScreenSpacePostPipeline;

    const previewEngine = {
      create: vi.fn(() => engine as unknown as Engine),
      attachScene: vi.fn(),
      start: vi.fn(),
      stopRenderLoop: vi.fn(),
      setPaused: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
      recorder: null,
    };

    const manager = new ScreenSpaceSceneManager(
      {
        createEngine: () => previewEngine as never,
        createScene: () => ({ scene, camera }),
        createEnvironment: () => environment,
        createSun: () => ({
          bind: vi.fn(),
          setIntensity: vi.fn(),
          dispose: vi.fn(),
        }),
        createGbuffer: () => gbuffer,
        createPipeline: () => pipeline,
      },
      meshProvider,
    );

    const errors: unknown[] = [];
    manager.onError = (next) => errors.push(next);

    await manager.init(
      {} as HTMLCanvasElement,
      { id: 'test', label: 'Test', url: 'scene.glb' },
      { id: 'hdri', label: 'HDRI', url: 'env.env', format: 'env' },
      STACK,
    );

    expect(errors).toHaveLength(1);
    expect(compile).toHaveBeenCalledTimes(2);
    expect(compile.mock.calls[1]?.[0]).toEqual({
      effects: [],
      tonemap: 'aces',
    });

    manager.dispose();
  });
});

describe('takeFrameDrawCalls', () => {
  it('reports the frame count and rolls the counter over', () => {
    const fetchNewFrame = vi.fn();
    const engine = {
      _drawCalls: { current: 1611, fetchNewFrame },
    } as unknown as Engine;

    expect(takeFrameDrawCalls(engine, 7)).toBe(1611);
    expect(fetchNewFrame).toHaveBeenCalledTimes(1);
  });

  it('falls back when the engine does not expose the counter', () => {
    expect(takeFrameDrawCalls({} as Engine, 7)).toBe(7);
  });
});
