// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { Mesh, Scene } from '@babylonjs/core';

import {
  buildShaderMaterial,
  SHADER_SAMPLERS,
  SHADER_UNIFORMS,
} from '../MaterialController';
import type { MaterialBlueprint } from '../PreviewTypes';

interface FakeMaterial {
  readonly name: string;
  readonly options: {
    readonly attributes: readonly string[];
    readonly uniforms: readonly string[];
    readonly samplers: readonly string[];
  };
  readonly source: { vertexSource: string; fragmentSource: string };
  wireframe: boolean;
  onCompiled: ((effect: unknown) => void) | null;
  onError: ((effect: unknown, errors: string) => void) | null;
  isReady(): boolean;
  getEffect(): null;
  dispose(): void;
  setFloat(): void;
  setInt(): void;
  setVector2(): void;
  setVector3(): void;
  setVector4(): void;
  setColor3(): void;
  setColor4(): void;
  setTexture(): void;
}

const { createdMaterials } = vi.hoisted(() => ({
  createdMaterials: [] as FakeMaterial[],
}));

vi.mock('@babylonjs/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@babylonjs/core')>();

  class FakeShaderMaterial implements FakeMaterial {
    readonly name: string;
    readonly options: FakeMaterial['options'];
    readonly source: FakeMaterial['source'];
    wireframe = false;
    onCompiled: FakeMaterial['onCompiled'] = null;
    onError: FakeMaterial['onError'] = null;

    constructor(
      name: string,
      _scene: unknown,
      source: FakeMaterial['source'],
      options: FakeMaterial['options'],
      _storeEffectOnSubMeshes: boolean,
    ) {
      this.name = name;
      this.source = source;
      this.options = options;
      createdMaterials.push(this);
    }

    isReady(): boolean {
      return true;
    }

    getEffect(): null {
      return null;
    }

    dispose(): void {}
    setFloat(): void {}
    setInt(): void {}
    setVector2(): void {}
    setVector3(): void {}
    setVector4(): void {}
    setColor3(): void {}
    setColor4(): void {}
    setTexture(): void {}
  }

  return { ...actual, ShaderMaterial: FakeShaderMaterial };
});

describe('buildShaderMaterial user data extras', () => {
  function blueprint(
    extraUniforms: readonly string[] = [],
    extraSamplers: readonly string[] = [],
  ): MaterialBlueprint {
    return {
      vertex: 'void main() {}',
      fragment: 'void main() {}',
      extraUniforms,
      extraSamplers,
    };
  }

  it('registers the built-in uniforms and samplers by default', () => {
    createdMaterials.length = 0;

    buildShaderMaterial({} as Scene, blueprint());

    const material = createdMaterials[0]!;
    expect(material.options.uniforms).toEqual([...SHADER_UNIFORMS]);
    expect(material.options.samplers).toEqual([...SHADER_SAMPLERS]);
  });

  it('spread-appends the extras onto copies', () => {
    createdMaterials.length = 0;

    buildShaderMaterial({} as Scene, blueprint(['tint', 'scale'], ['map']));

    const material = createdMaterials[0]!;
    expect(material.options.uniforms).toEqual([
      ...SHADER_UNIFORMS,
      'tint',
      'scale',
    ]);
    expect(material.options.samplers).toEqual([...SHADER_SAMPLERS, 'map']);
  });

  it('never mutates the shared uniform/sampler lists', () => {
    const uniformsBefore = [...SHADER_UNIFORMS];
    const samplersBefore = [...SHADER_SAMPLERS];

    buildShaderMaterial({} as Scene, blueprint(['tint'], ['map']));

    expect(SHADER_UNIFORMS).toEqual(uniformsBefore);
    expect(SHADER_SAMPLERS).toEqual(samplersBefore);
  });

  it('detaches the registered arrays from later source mutations', () => {
    createdMaterials.length = 0;
    const extras: string[] = ['tint'];
    const source = blueprint(extras);

    buildShaderMaterial({} as Scene, source);
    extras.push('added-later');

    expect(createdMaterials[0]!.options.uniforms).not.toContain('added-later');
  });

  it('keeps the wireframe flag and the shader sources', () => {
    createdMaterials.length = 0;

    buildShaderMaterial({} as Scene, blueprint(), 'previewShader', true);

    const material = createdMaterials[0]!;
    expect(material.wireframe).toBe(true);
    expect(material.source.vertexSource).toBe('void main() {}');
    expect(material.source.fragmentSource).toBe('void main() {}');
  });
});

describe('ShaderCompiler user data pass-through', () => {
  it('forwards the blueprint extras into buildShaderMaterial', async () => {
    const { ShaderCompiler } = await import('./ShaderCompiler');
    const compiler = new ShaderCompiler({
      isDisposed: false,
    } as unknown as Scene);
    const mesh = {} as Mesh;
    const source = {
      vertex: 'void main() {}',
      fragment: 'void main() {}',
      extraUniforms: ['tint'],
      extraSamplers: ['map'],
    } satisfies MaterialBlueprint;

    const attempt = await compiler.tryCompile(source, mesh);

    expect(attempt.ok).toBe(true);
    const material = attempt.material as unknown as FakeMaterial;
    expect(material.options.uniforms).toContain('tint');
    expect(material.options.samplers).toContain('map');

    attempt.release(false);
  });
});
