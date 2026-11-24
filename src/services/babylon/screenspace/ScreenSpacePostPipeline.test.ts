import {
  Matrix,
  Vector3,
  type Camera,
  type PostProcess,
  type Scene,
} from '@babylonjs/core';
import { describe, expect, it, vi } from 'vitest';

import type {
  PostEffectSource,
  PostEffectStack,
} from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import type { PostEffectCompiler } from '../preview/post/PostEffectCompiler';
import { ScreenSpacePostPipeline } from './ScreenSpacePostPipeline';
import type { ScreenSpaceGbuffer } from './ScreenSpaceGbuffer';

function postEffect(id: string): PostEffectSource {
  return {
    id,
    name: id,
    fragment: 'void main() {}',
    editorSource: 'void main() {}',
    extraUniforms: [],
    extraSamplers: [],
    injected: null,
    declarationRowByLine: [],
  };
}

function stack(effects: readonly PostEffectSource[]): PostEffectStack {
  return { effects, tonemap: 'aces' };
}

function fakePass(): PostProcess & { dispose: ReturnType<typeof vi.fn> } {
  return {
    onApplyObservable: { add: vi.fn() },
    dispose: vi.fn(),
    getEffect: () => null,
    inputTexture: { texture: null },
  } as unknown as PostProcess & { dispose: ReturnType<typeof vi.fn> };
}

const FAILURE: ShaderError = {
  stage: 'post',
  line: 1,
  column: 1,
  kind: 'syntax',
  title: 'bad',
  message: 'bad',
  advice: null,
  effectId: 'e1',
};

function setup(results: readonly unknown[]) {
  const attach = vi.fn();
  const detach = vi.fn();
  const camera = {
    attachPostProcess: attach,
    detachPostProcess: detach,
    getViewMatrix: () => Matrix.Identity(),
    getProjectionMatrix: () => Matrix.Identity(),
    minZ: 0.1,
    maxZ: 100,
    globalPosition: Vector3.Zero(),
  } as unknown as Camera;

  const scene = {
    onBeforeRenderObservable: {
      add: vi.fn(() => 1),
      remove: vi.fn(),
    },
  } as unknown as Scene;

  const refreshPrePass = vi.fn();
  const gbuffer = {
    refreshPrePass,
    bind: vi.fn(),
    overlay: { bind: vi.fn() },
    setObjectIdEnabled: vi.fn(),
    resize: vi.fn(),
  } as unknown as ScreenSpaceGbuffer;

  const compile = vi.fn();
  for (const result of results) compile.mockResolvedValueOnce(result);

  const compiler = { compile } as unknown as PostEffectCompiler;

  const pipeline = new ScreenSpacePostPipeline({
    scene,
    camera,
    engine: {
      getCaps: () => ({
        textureHalfFloatRender: true,
        textureFloatRender: false,
      }),
      getRenderWidth: () => 1280,
      getRenderHeight: () => 720,
      getDeltaTime: () => 16,
    } as never,
    textures: { textureFor: () => null } as never,
    getUserBindings: () => [],
    recorder: null,
    gbuffer,
    compiler,
  });

  return { pipeline, compile, attach, detach, refreshPrePass };
}

describe('ScreenSpacePostPipeline', () => {
  it('installs a compiled effect and the display pass', async () => {
    const effectPass = fakePass();
    const displayPass = fakePass();
    const { pipeline, compile, attach, refreshPrePass } = setup([
      { ok: true, postProcess: effectPass },
      { ok: true, postProcess: displayPass },
    ]);

    const result = await pipeline.compile(stack([postEffect('e1')]));

    expect(result.status).toBe('ok');
    expect(compile).toHaveBeenCalledTimes(2);
    expect(attach).toHaveBeenCalledWith(effectPass);
    expect(attach).toHaveBeenCalledWith(displayPass);
    expect(pipeline.passes).toHaveLength(2);
    expect(pipeline.displayPass).toBe(displayPass);
    expect(refreshPrePass).toHaveBeenCalledWith([effectPass, displayPass]);
  });

  it('keeps the previous chain when a later compile fails', async () => {
    const effectPass = fakePass();
    const displayPass = fakePass();
    const { pipeline, attach, detach } = setup([
      { ok: true, postProcess: effectPass },
      { ok: true, postProcess: displayPass },
      { ok: false, errors: [FAILURE] },
    ]);

    await pipeline.compile(stack([postEffect('e1')]));
    const result = await pipeline.compile(stack([postEffect('e1')]));

    expect(result.status).toBe('failed');
    expect(pipeline.passes).toEqual([effectPass, displayPass]);
    expect(detach).not.toHaveBeenCalled();
    expect(effectPass.dispose).not.toHaveBeenCalled();
    expect(attach).toHaveBeenCalledTimes(2); // only the first install
  });

  it('installs only the display pass when the stack is empty', async () => {
    const displayPass = fakePass();
    const { pipeline, attach } = setup([
      { ok: true, postProcess: displayPass },
    ]);

    const result = await pipeline.compile(stack([]));

    expect(result.status).toBe('ok');
    expect(attach).toHaveBeenCalledWith(displayPass);
    expect(pipeline.displayPass).toBe(displayPass);
  });
});
