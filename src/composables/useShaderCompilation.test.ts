import { describe, expect, it, vi } from 'vitest';

import type { CompileResult } from '@/core/models/compileResult';
import type { PostEffectStack } from '@/core/models/postEffect';
import type { MaterialBlueprint } from '@/core/models/shaderSource';
import { useShaderCompilation } from './useShaderCompilation';

function blueprint(vertex: string): MaterialBlueprint {
  return {
    vertex,
    fragment: '// fragment',
    editorSource: { vertex, fragment: '// fragment' },
    extraUniforms: [],
    extraSamplers: [],
  };
}

const STACK: PostEffectStack = { tonemap: 'none', effects: [] };
const OK: CompileResult = { status: 'ok' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

function createCompilation(
  overrides: Partial<{
    compileMaterial: (blueprint: MaterialBlueprint) => Promise<CompileResult>;
    compilePostEffects: (stack: PostEffectStack) => Promise<CompileResult>;
  }> = {},
) {
  const onOutcome = vi.fn();
  const compilation = useShaderCompilation({
    compileMaterial: overrides.compileMaterial ?? vi.fn(async () => OK),
    compilePostEffects: overrides.compilePostEffects ?? vi.fn(async () => OK),
    getMaterialBlueprint: () => blueprint('editor'),
    getPostStack: () => STACK,
    onBeforeCompile: vi.fn(),
    onOutcome,
    onExternalErrors: vi.fn(),
  });

  return { compilation, onOutcome };
}

/** Lets the queue's microtask chain advance one step. */
async function settleQueue(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('useShaderCompilation queue', () => {
  it('runs one compile at a time and coalesces queued material requests', async () => {
    const first = deferred<CompileResult>();
    const compileMaterial = vi
      .fn<(blueprint: MaterialBlueprint) => Promise<CompileResult>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(OK);

    const { compilation } = createCompilation({ compileMaterial });

    const running = compilation.compileMaterial(blueprint('a'));
    const superseded = compilation.compileMaterial(blueprint('b'));
    const latest = compilation.compileMaterial(blueprint('c'));

    // Only the in-flight request reached the engine; b was replaced by c.
    expect(compileMaterial).toHaveBeenCalledTimes(1);
    expect(compileMaterial.mock.calls[0]?.[0]?.vertex).toBe('a');

    // A superseded request settles immediately instead of waiting.
    await expect(superseded).resolves.toBeUndefined();
    await expect(compileMaterial).toHaveBeenCalledTimes(1);

    first.resolve(OK);
    await running;
    await latest;
    await settleQueue();

    expect(compileMaterial).toHaveBeenCalledTimes(2);
    expect(compileMaterial.mock.calls[1]?.[0]?.vertex).toBe('c');
  });

  it('coalesces post-effect requests behind a running material compile', async () => {
    const first = deferred<CompileResult>();
    const compileMaterial = vi
      .fn<(blueprint: MaterialBlueprint) => Promise<CompileResult>>()
      .mockReturnValueOnce(first.promise);

    const compilePostEffects = vi.fn(async () => OK);
    const { compilation } = createCompilation({
      compileMaterial,
      compilePostEffects,
    });

    const running = compilation.compileMaterial(blueprint('a'));
    const postA = compilation.compilePostEffects();
    const postB = compilation.compilePostEffects();

    expect(compilePostEffects).not.toHaveBeenCalled();
    await expect(postA).resolves.toBeUndefined();

    first.resolve(OK);
    await running;
    await postB;
    await settleQueue();

    expect(compilePostEffects).toHaveBeenCalledTimes(1);
  });

  it('reports the failure state and clears it on the next success', async () => {
    const failure: CompileResult = {
      status: 'failed',
      errors: [
        {
          stage: 'fragment',
          line: 3,
          column: null,
          kind: 'syntax',
          title: 'Syntax error',
          message: 'unexpected token',
          advice: null,
        },
      ],
    };

    const compileMaterial = vi
      .fn<(blueprint: MaterialBlueprint) => Promise<CompileResult>>()
      .mockResolvedValueOnce(failure)
      .mockResolvedValueOnce(OK);

    const { compilation, onOutcome } = createCompilation({ compileMaterial });

    await compilation.compileMaterial(blueprint('a'));

    expect(compilation.status.value).toBe('error');
    expect(compilation.errors.value).toHaveLength(1);
    expect(compilation.statusMessage.value?.key).toBe(
      'editor.status.messages.shaderErrorsAtLine',
    );
    expect(onOutcome).toHaveBeenLastCalledWith(failure);

    await compilation.compileMaterial(blueprint('b'));

    expect(compilation.status.value).toBe('ready');
    expect(compilation.errors.value).toEqual([]);
    expect(onOutcome).toHaveBeenLastCalledWith(OK);
  });

  it('turns a thrown compile into an internal diagnostic', async () => {
    const compileMaterial = vi
      .fn<(blueprint: MaterialBlueprint) => Promise<CompileResult>>()
      .mockRejectedValueOnce(new Error('driver exploded'));

    const { compilation } = createCompilation({ compileMaterial });

    await compilation.compileMaterial(blueprint('a'));

    expect(compilation.status.value).toBe('error');
    expect(compilation.errors.value[0]?.kind).toBe('internal');
    expect(compilation.errors.value[0]?.message).toBe('driver exploded');
  });

  it('reports driver-time errors through the same state', () => {
    const { compilation } = createCompilation();

    compilation.reportErrors([
      {
        stage: 'program',
        line: null,
        column: null,
        kind: 'internal',
        title: 'Lost context',
        message: 'WebGL context lost',
        advice: null,
      },
    ]);

    expect(compilation.status.value).toBe('error');
    expect(compilation.errors.value).toHaveLength(1);
    expect(compilation.statusMessage.value?.key).toBe(
      'editor.status.messages.shaderErrors',
    );
  });
});
