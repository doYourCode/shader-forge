// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UserDataController } from '@/services/userdata/UserDataController';
import type { SandboxTextureRegistryOptions } from './SandboxTextureRegistry';

const { registryOptions, registry } = vi.hoisted(() => {
  const registryOptions: { current: SandboxTextureRegistryOptions | null } = {
    current: null,
  };
  const registry = {
    dispose: vi.fn(),
    load: vi.fn(),
    release: vi.fn(),
    textureFor: vi.fn(),
  };
  return { registryOptions, registry };
});

vi.mock('./SandboxTextureRegistry', () => ({
  SandboxTextureRegistry: class {
    constructor(
      _gl: WebGL2RenderingContext,
      _lookup: unknown,
      options: SandboxTextureRegistryOptions,
    ) {
      registryOptions.current = options;
      return registry;
    }
  },
}));

import { SandboxPreview } from './SandboxPreview';

function createCanvas() {
  const gl = {
    getExtension: vi.fn(() => null),
    createVertexArray: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),
    deleteVertexArray: vi.fn(),
    disable: vi.fn(),
    clearColor: vi.fn(),
    DEPTH_TEST: 1,
    CULL_FACE: 2,
    getShaderInfoLog: vi.fn(),
    getProgramInfoLog: vi.fn(),
  } as unknown as WebGL2RenderingContext;

  const canvas = {
    getContext: vi.fn(() => gl),
    clientWidth: 320,
    clientHeight: 180,
    width: 0,
    height: 0,
  } as unknown as HTMLCanvasElement;

  return { canvas, gl };
}

describe('SandboxPreview user data', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    registry.dispose.mockClear();
    registryOptions.current = null;
  });

  it('redraws one frame after a texture becomes ready', () => {
    // Keep the constructor from starting a real animation loop.
    vi.stubGlobal('requestAnimationFrame', undefined);

    const { canvas } = createCanvas();
    const preview = new SandboxPreview(canvas);
    const renderOnce = vi.spyOn(preview, 'renderOnce');
    const controller = {
      attachGpu: vi.fn(),
      applyBindings: vi.fn(),
      onMaterialApplied: vi.fn(),
    } as unknown as UserDataController<WebGLTexture>;

    preview.attachUserData(controller);
    registryOptions.current?.onTextureReady?.();

    expect(renderOnce).toHaveBeenCalledTimes(1);

    preview.dispose();
    expect(controller.attachGpu).toHaveBeenLastCalledWith(null);
    expect(registry.dispose).toHaveBeenCalledTimes(1);
  });
});
