import { describe, expect, it } from 'vitest';

import { assertWebGl2 } from './SceneManager';

describe('assertWebGl2', () => {
  it('accepts a WebGL 2 engine', () => {
    expect(assertWebGl2({ webGLVersion: 2 })).toEqual({ ok: true });
  });

  it('accepts a hypothetical engine newer than WebGL 2', () => {
    expect(assertWebGl2({ webGLVersion: 3 })).toEqual({ ok: true });
  });

  it('rejects a WebGL 1 engine with a single internal error', () => {
    const result = assertWebGl2({ webGLVersion: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toEqual({
      stage: 'program',
      line: null,
      column: null,
      kind: 'internal',
      title: 'WebGL 2 is required',
      message:
        'WebGL 2 is required to render the shader preview, but the browser created a WebGL 1 context.',
      advice:
        'Use a browser or device with WebGL 2 support, and make sure hardware acceleration is enabled.',
    });
  });

  it('rejects an engine without a usable version', () => {
    expect(assertWebGl2({ webGLVersion: 0 }).ok).toBe(false);
    expect(assertWebGl2({ webGLVersion: Number.NaN }).ok).toBe(false);
  });
});
