import { describe, expect, it, vi } from 'vitest';

import { SandboxUniformBindingTarget } from './SandboxUniformBindingTarget';

const TEXTURE0 = 0x84c0;
const TEXTURE_2D = 0x0de1;

function createHarness(missing: readonly string[] = []) {
  const locations = new Map<string, WebGLUniformLocation | null>();
  const calls = {
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),
  };

  const gl = {
    TEXTURE0,
    TEXTURE_2D,
    useProgram: vi.fn(),
    getUniformLocation: vi.fn((_program: WebGLProgram, name: string) => {
      if (missing.includes(name)) return null;
      let location = locations.get(name);
      if (location === undefined) {
        location = { name } as unknown as WebGLUniformLocation;
        locations.set(name, location);
      }
      return location;
    }),
    ...calls,
  } as unknown as WebGL2RenderingContext;

  const program = {} as WebGLProgram;
  const target = new SandboxUniformBindingTarget(gl, program);

  return { target, gl, program, calls };
}

describe('SandboxUniformBindingTarget', () => {
  it('maps scalar, vector and colour values to the matching GL call', () => {
    const { target, calls } = createHarness();

    target.setFloat('scale', 2);
    target.setInt('steps', 4);
    target.setVector2('offset', { x: 1, y: 2 });
    target.setVector3('tint', { x: 1, y: 2, z: 3 });
    target.setVector4('tint4', { x: 1, y: 2, z: 3, w: 4 });
    target.setColor3('color', { r: 0.1, g: 0.2, b: 0.3 });
    target.setColor4('color4', { r: 0.1, g: 0.2, b: 0.3, a: 0.4 });

    expect(calls.uniform1f).toHaveBeenCalledWith(expect.anything(), 2);
    expect(calls.uniform1i).toHaveBeenCalledWith(expect.anything(), 4);
    expect(calls.uniform2f).toHaveBeenCalledWith(expect.anything(), 1, 2);
    expect(calls.uniform3f).toHaveBeenCalledWith(expect.anything(), 1, 2, 3);
    expect(calls.uniform4f).toHaveBeenCalledWith(expect.anything(), 1, 2, 3, 4);
    expect(calls.uniform3f).toHaveBeenCalledWith(
      expect.anything(),
      0.1,
      0.2,
      0.3,
    );
    expect(calls.uniform4f).toHaveBeenCalledWith(
      expect.anything(),
      0.1,
      0.2,
      0.3,
      0.4,
    );
  });

  it('caches uniform locations per name', () => {
    const { target, gl } = createHarness();

    target.setFloat('scale', 1);
    target.setFloat('scale', 2);

    expect(gl.getUniformLocation).toHaveBeenCalledTimes(1);
  });

  it('skips uniforms the linker dropped', () => {
    const { target, calls } = createHarness(['unused']);

    target.setFloat('unused', 2);

    expect(calls.uniform1f).not.toHaveBeenCalled();
  });

  it('allocates a texture unit per sampler and binds the texture', () => {
    const { target, calls } = createHarness();
    const first = {} as WebGLTexture;
    const second = {} as WebGLTexture;

    target.setTexture('albedo', first);
    target.setTexture('detail', second);

    expect(calls.activeTexture).toHaveBeenCalledWith(TEXTURE0);
    expect(calls.activeTexture).toHaveBeenCalledWith(TEXTURE0 + 1);
    expect(calls.bindTexture).toHaveBeenNthCalledWith(1, TEXTURE_2D, first);
    expect(calls.bindTexture).toHaveBeenNthCalledWith(2, TEXTURE_2D, second);
    expect(calls.uniform1i).toHaveBeenNthCalledWith(1, expect.anything(), 0);
    expect(calls.uniform1i).toHaveBeenNthCalledWith(2, expect.anything(), 1);
    // The active unit is restored after each binding.
    expect(calls.activeTexture).toHaveBeenLastCalledWith(TEXTURE0);
  });
});
