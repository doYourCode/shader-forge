import {
  Matrix,
  Vector3,
  type Camera,
  type PostProcess,
  type Scene,
} from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

/** Callbacks registered through `onApplyObservable` in the current test. */
let applyHandlers: (() => void)[] = [];

function fakeEffect(samplers: readonly string[]) {
  return {
    getSamplers: () => samplers,
    setFloat: vi.fn(),
    setFloat2: vi.fn(),
    setVector3: vi.fn(),
    setMatrix: vi.fn(),
    setTexture: vi.fn(),
  };
}

function fakePass(
  samplers: readonly string[] = [],
): PostProcess & { dispose: ReturnType<typeof vi.fn> } {
  const effect = fakeEffect(samplers);

  return {
    onApplyObservable: {
      add: (handler: () => void) => {
        applyHandlers.push(handler);
        return {};
      },
    },
    dispose: vi.fn(),
    getEffect: () => effect as never,
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
  const setRequiredAttachments = vi.fn();
  const setObjectIdEnabled = vi.fn();
  const bindTransparent = vi.fn();
  const gbuffer = {
    refreshPrePass,
    bind: vi.fn(),
    bindTransparent,
    setRequiredAttachments,
    setObjectIdEnabled,
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

  return {
    pipeline,
    compile,
    attach,
    detach,
    refreshPrePass,
    setRequiredAttachments,
    setObjectIdEnabled,
    bindTransparent,
  };
}

beforeEach(() => {
  applyHandlers = [];
});

describe('ScreenSpacePostPipeline', () => {
  it('installs a compiled effect and the display pass', async () => {
    const effectPass = fakePass(['textureSampler']);
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

  it('does not enable the object-id pass for a declared-but-unread sampler', async () => {
    const { pipeline, setObjectIdEnabled } = setup([
      { ok: true, postProcess: fakePass(['textureSampler']) },
      { ok: true, postProcess: fakePass() },
    ]);

    await pipeline.compile(stack([postEffect('e1')]));

    expect(setObjectIdEnabled).toHaveBeenCalledWith(false);
  });

  it('enables the object-id pass when an effect reads it', async () => {
    const { pipeline, setObjectIdEnabled } = setup([
      {
        ok: true,
        postProcess: fakePass(['textureSampler', 'objectIdTexture']),
      },
      { ok: true, postProcess: fakePass() },
    ]);

    await pipeline.compile(stack([postEffect('e1')]));

    expect(setObjectIdEnabled).toHaveBeenCalledWith(true);
  });

  it('requests no G-buffer attachment for a passthrough', async () => {
    const { pipeline, setRequiredAttachments } = setup([
      { ok: true, postProcess: fakePass(['textureSampler']) },
      { ok: true, postProcess: fakePass() },
    ]);

    await pipeline.compile(stack([postEffect('e1')]));

    expect(setRequiredAttachments).toHaveBeenCalledWith(new Set());
  });

  it('requests only the attachments the effect reads', async () => {
    const { pipeline, setRequiredAttachments } = setup([
      {
        ok: true,
        postProcess: fakePass([
          'textureSampler',
          'depthTexture',
          'normalTexture',
        ]),
      },
      { ok: true, postProcess: fakePass() },
    ]);

    await pipeline.compile(stack([postEffect('e1')]));

    expect(setRequiredAttachments).toHaveBeenCalledWith(
      new Set(['depth', 'normal']),
    );
  });

  it('binds the transparent overlay stand-in on the display pass', async () => {
    const { pipeline, bindTransparent } = setup([
      { ok: true, postProcess: fakePass(['textureSampler']) },
      { ok: true, postProcess: fakePass() },
    ]);

    await pipeline.compile(stack([postEffect('e1')]));
    const displayApply = applyHandlers[applyHandlers.length - 1];
    expect(displayApply).toBeTypeOf('function');

    displayApply?.();

    expect(bindTransparent).toHaveBeenCalled();
  });
});
