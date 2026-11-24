// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PostEffectStack } from '@/core/models/postEffect';
import type { UserDataController } from '@/services/userdata/UserDataController';

const { pipeline } = vi.hoisted(() => {
  const pipeline = {
    hasChain: vi.fn(() => true),
    beginBasePass: vi.fn(() => true),
    renderChain: vi.fn(),
    compile: vi.fn(() => ({ status: 'ok' as const })),
    bindingTargets: vi.fn(() => []),
    setTonemap: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  return { pipeline };
});

vi.mock('./SandboxPostPipeline', () => ({
  SandboxPostPipeline: class {
    constructor() {
      return pipeline;
    }
  },
}));

import { SandboxPreview } from './SandboxPreview';

function createCanvas() {
  const gl = {
    createVertexArray: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),
    deleteVertexArray: vi.fn(),
    disable: vi.fn(),
    clearColor: vi.fn(),
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

  return canvas;
}

const STACK: PostEffectStack = { tonemap: 'none', effects: [] };

describe('SandboxPreview post integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    pipeline.compile.mockClear();
    pipeline.setTonemap.mockClear();
    pipeline.dispose.mockClear();
  });

  it('delegates post compilation, tonemap and disposal to the pipeline', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);

    const preview = new SandboxPreview(createCanvas());
    const controller = {
      attachGpu: vi.fn(),
      applyBindings: vi.fn(),
      onMaterialApplied: vi.fn(),
    } as unknown as UserDataController<WebGLTexture>;
    preview.attachUserData(controller);
    const renderOnce = vi.spyOn(preview, 'renderOnce');

    expect(preview.compilePostEffects(STACK)).toEqual({ status: 'ok' });
    expect(pipeline.resize).toHaveBeenCalled();
    expect(pipeline.compile).toHaveBeenCalledWith(STACK);
    expect(renderOnce).toHaveBeenCalled();

    preview.setTonemap('aces');
    expect(pipeline.setTonemap).toHaveBeenCalledWith('aces');
    expect(renderOnce).toHaveBeenCalledTimes(2);

    preview.dispose();
    expect(pipeline.dispose).toHaveBeenCalledTimes(1);
    expect(controller.attachGpu).toHaveBeenLastCalledWith(null);
  });
});
