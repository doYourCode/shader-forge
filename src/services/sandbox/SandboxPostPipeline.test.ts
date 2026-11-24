import { describe, expect, it, vi } from 'vitest';

import type {
  PostEffectSource,
  PostEffectStack,
} from '@/core/models/postEffect';
import type { ShaderCompileRecord } from '@/core/utils/shaderErrors';
import type { ShaderLogRecorder } from '@/services/webgl/ShaderLogRecorder';
import { SandboxPostPipeline } from './SandboxPostPipeline';

const VERTEX_SHADER = 0x8b31;
const FRAGMENT_SHADER = 0x8b30;
const COMPILE_STATUS = 0x8b81;
const LINK_STATUS = 0x8b82;
const FRAGMENT_SHADER_FLAG = FRAGMENT_SHADER;
const TEXTURE_2D = 0x0de1;
const TEXTURE0 = 0x84c0;
const RGBA = 0x1908;
const RGBA8 = 0x8058;
const RGBA16F = 0x881a;
const UNSIGNED_BYTE = 0x1401;
const HALF_FLOAT = 0x140b;
const LINEAR = 0x2601;
const NEAREST = 0x2600;
const CLAMP_TO_EDGE = 0x812f;
const TEXTURE_MIN_FILTER = 0x2801;
const TEXTURE_MAG_FILTER = 0x2800;
const TEXTURE_WRAP_S = 0x2802;
const TEXTURE_WRAP_T = 0x2803;
const FRAMEBUFFER = 0x8d40;
const COLOR_ATTACHMENT0 = 0x8ce0;
const FRAMEBUFFER_COMPLETE = 0x8cd5;
const TRIANGLES = 0x0004;
const COLOR_BUFFER_BIT = 0x4000;

interface FakeShader {
  readonly id: number;
  readonly type: number;
  source: string;
}

interface FakeProgram {
  readonly id: number;
  readonly shaders: FakeShader[];
  broken: boolean;
}

interface FakeTexture {
  readonly id: number;
}

interface FakeFramebuffer {
  readonly id: number;
}

function createHarness() {
  let nextId = 1;
  let records: ShaderCompileRecord[] = [];
  const shaders = new Map<number, FakeShader>();
  const programs = new Map<number, FakeProgram>();
  const draws: number[] = [];
  const framebuffers: (number | null)[] = [];
  const activeTextures: number[] = [];
  const floats: { name: string; value: number }[] = [];

  const gl = {
    VERTEX_SHADER,
    FRAGMENT_SHADER,
    COMPILE_STATUS,
    LINK_STATUS,
    TEXTURE_2D,
    TEXTURE0,
    RGBA,
    RGBA8,
    RGBA16F,
    UNSIGNED_BYTE,
    HALF_FLOAT,
    LINEAR,
    NEAREST,
    CLAMP_TO_EDGE,
    TEXTURE_MIN_FILTER,
    TEXTURE_MAG_FILTER,
    TEXTURE_WRAP_S,
    TEXTURE_WRAP_T,
    FRAMEBUFFER,
    COLOR_ATTACHMENT0,
    FRAMEBUFFER_COMPLETE,
    TRIANGLES,
    COLOR_BUFFER_BIT,

    getExtension: vi.fn(() => null),
    createShader: vi.fn((type: number) => {
      const shader: FakeShader = { id: nextId++, type, source: '' };
      shaders.set(shader.id, shader);
      return shader;
    }),
    shaderSource: vi.fn((shader: FakeShader, source: string) => {
      shader.source = source;
    }),
    compileShader: vi.fn(),
    getShaderInfoLog: vi.fn((shader: FakeShader) => {
      if (!shader.source.includes('BROKEN')) return '';
      const message = "ERROR: 0:1: 'x' : undeclared identifier";
      records.push({
        stage: shader.type === FRAGMENT_SHADER_FLAG ? 'fragment' : 'vertex',
        log: message,
        source: shader.source,
      });
      return message;
    }),
    getShaderParameter: vi.fn((shader: FakeShader, pname: number) =>
      pname === COMPILE_STATUS ? !shader.source.includes('BROKEN') : true,
    ),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => {
      const program: FakeProgram = {
        id: nextId++,
        shaders: [],
        broken: false,
      };
      programs.set(program.id, program);
      return program;
    }),
    attachShader: vi.fn((program: FakeProgram, shader: FakeShader) => {
      program.shaders.push(shader);
    }),
    linkProgram: vi.fn((program: FakeProgram) => {
      program.broken = program.shaders.some((shader) =>
        shader.source.includes('BROKEN'),
      );
    }),
    getProgramInfoLog: vi.fn(() => ''),
    getProgramParameter: vi.fn((program: FakeProgram, pname: number) =>
      pname === LINK_STATUS ? !program.broken : true,
    ),
    deleteProgram: vi.fn(),
    getUniformLocation: vi.fn(
      (_program: FakeProgram, name: string) =>
        ({ name }) as unknown as WebGLUniformLocation,
    ),
    useProgram: vi.fn(),
    uniform1f: vi.fn((location: { name: string }, value: number) => {
      floats.push({ name: location.name, value });
    }),
    uniform1i: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    createTexture: vi.fn((): FakeTexture => ({ id: nextId++ })),
    deleteTexture: vi.fn(),
    bindTexture: vi.fn(),
    activeTexture: vi.fn((unit: number) => {
      activeTextures.push(unit);
    }),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    createFramebuffer: vi.fn((): FakeFramebuffer => ({ id: nextId++ })),
    deleteFramebuffer: vi.fn(),
    bindFramebuffer: vi.fn((_target: number, fb: FakeFramebuffer | null) => {
      framebuffers.push(fb?.id ?? null);
    }),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn(() => FRAMEBUFFER_COMPLETE),
    viewport: vi.fn(),
    clear: vi.fn(),
    drawArrays: vi.fn(() => {
      draws.push(1);
    }),
    isContextLost: vi.fn(() => false),
  };

  const recorder = {
    begin: vi.fn(() => {
      records = [];
    }),
    drain: vi.fn(() => records),
  } as unknown as ShaderLogRecorder;

  const pipeline = new SandboxPostPipeline(
    gl as unknown as WebGL2RenderingContext,
    recorder,
  );

  return {
    pipeline,
    gl,
    draws,
    framebuffers,
    activeTextures,
    floats,
    shaders,
    programs,
  };
}

function effect(fragment: string): PostEffectSource {
  return {
    id: 'effect-1',
    name: 'Effect 1',
    fragment,
    editorSource: fragment,
    extraUniforms: [],
    extraSamplers: [],
    injected: null,
    declarationRowByLine: [],
  };
}

function stack(...effects: PostEffectSource[]): PostEffectStack {
  return { tonemap: 'none', effects };
}

const PASSTHROUGH = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D textureSampler;
out vec4 fragColor;
void main() { fragColor = texture(textureSampler, vUV); }`;

describe('SandboxPostPipeline', () => {
  it('compiles linearize, every effect and display, then renders the chain', () => {
    const { pipeline, draws, framebuffers, activeTextures } = createHarness();

    pipeline.resize(320, 180);
    expect(pipeline.compile(stack(effect(PASSTHROUGH)))).toEqual({
      status: 'ok',
    });
    expect(pipeline.hasChain()).toBe(true);
    expect(pipeline.bindingTargets()).toHaveLength(1);

    expect(pipeline.beginBasePass()).toBe(true);
    pipeline.renderChain(1.5);

    expect(draws).toHaveLength(3);
    // The display pass is the only one that targets the default framebuffer.
    expect(framebuffers.at(-1)).toBeNull();
    // The effect pass binds textureSampler, gbufferTexture and depthTexture.
    expect(activeTextures).toContain(TEXTURE0 + 1);
    expect(activeTextures).toContain(TEXTURE0 + 2);
  });

  it('installs the tonemap carried by the compiled stack', () => {
    const { pipeline, floats } = createHarness();

    pipeline.resize(320, 180);
    pipeline.compile({ tonemap: 'reinhard', effects: [effect(PASSTHROUGH)] });
    pipeline.renderChain(1);

    expect(floats).toContainEqual({ name: 'toneMappingMode', value: 1 });
  });

  it('applies the tonemap in the display pass without recompiling', () => {
    const { pipeline, floats } = createHarness();

    pipeline.resize(320, 180);
    pipeline.compile(stack(effect(PASSTHROUGH)));
    pipeline.setTonemap('aces');
    pipeline.renderChain(1);

    expect(floats).toContainEqual({ name: 'toneMappingMode', value: 2 });
  });

  it('keeps the previous chain when a new effect fails to compile', () => {
    const { pipeline, gl } = createHarness();

    pipeline.resize(320, 180);
    expect(pipeline.compile(stack(effect(PASSTHROUGH)))).toEqual({
      status: 'ok',
    });
    const deletedBefore = gl.deleteProgram.mock.calls.length;

    const result = pipeline.compile(
      stack(effect(PASSTHROUGH.replace('void main', 'BROKEN void main'))),
    );

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.errors[0]?.stage).toBe('post');
      expect(result.errors[0]?.effectId).toBe('effect-1');
    }
    expect(pipeline.hasChain()).toBe(true);
    // Only the candidate linearize program was rolled back; the old chain
    // remains installed.
    expect(gl.deleteProgram.mock.calls.length).toBe(deletedBefore + 1);
  });

  it('disposes programs, targets and dummy textures', () => {
    const { pipeline, gl } = createHarness();

    pipeline.resize(64, 64);
    pipeline.compile(stack(effect(PASSTHROUGH)));
    pipeline.dispose();

    expect(gl.deleteProgram).toHaveBeenCalledTimes(3);
    expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(2);
    expect(gl.deleteTexture).toHaveBeenCalledTimes(4);
    expect(pipeline.hasChain()).toBe(false);
  });
});
