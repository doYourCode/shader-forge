import { describe, expect, it, vi } from 'vitest';
import type { BaseTexture } from '@babylonjs/core';

import type { UserUniformKind, UserUniformValue } from '@/core/models/userUniform';
import {
  toUniformBinding,
  UniformBinder,
  UNIFORM_KIND_SETTERS,
  type UniformBinding,
  type UniformBindingTarget,
} from './UniformBinder';

function binding(
  kind: UserUniformKind,
  value: UserUniformValue,
  name = 'myUniform',
  id = 'u1',
): UniformBinding {
  return { id, name, kind, value };
}

function createTarget() {
  const target: UniformBindingTarget = {
    setFloat: vi.fn(),
    setInt: vi.fn(),
    setVector2: vi.fn(),
    setVector3: vi.fn(),
    setVector4: vi.fn(),
    setColor3: vi.fn(),
    setColor4: vi.fn(),
    setTexture: vi.fn(),
  };
  return target;
}

function createBinder() {
  const texture = { dispose: vi.fn() } as unknown as BaseTexture;
  const textures = { textureFor: vi.fn(() => texture) };
  const binder = new UniformBinder(textures);
  return { binder, textures, texture };
}

describe('UNIFORM_KIND_SETTERS', () => {
  it('routes every kind to its matching setter', () => {
    const target = createTarget();
    const context = { resolveTexture: vi.fn(() => null) };

    const cases: Array<[UserUniformKind, UserUniformValue]> = [
      ['float', 0.5],
      ['vec2', { x: 1, y: 2 }],
      ['vec3', { x: 1, y: 2, z: 3 }],
      ['vec4', { x: 1, y: 2, z: 3, w: 4 }],
      ['color', { r: 0.1, g: 0.2, b: 0.3 }],
      ['color4', { r: 0.1, g: 0.2, b: 0.3, a: 0.4 }],
      ['direction', { x: 0, y: 1, z: 0 }],
      ['position', { x: 1, y: 2, z: 3 }],
    ];

    for (const [kind, value] of cases) {
      UNIFORM_KIND_SETTERS[kind](target, binding(kind, value), context);
    }

    expect(target.setFloat).toHaveBeenCalledWith('myUniform', 0.5);
    expect(target.setVector2).toHaveBeenCalledWith('myUniform', { x: 1, y: 2 });
    expect(target.setVector3).toHaveBeenCalledWith('myUniform', {
      x: 1,
      y: 2,
      z: 3,
    });
    expect(target.setVector4).toHaveBeenCalledWith('myUniform', {
      x: 1,
      y: 2,
      z: 3,
      w: 4,
    });
    expect(target.setColor3).toHaveBeenCalledWith('myUniform', {
      r: 0.1,
      g: 0.2,
      b: 0.3,
    });
    expect(target.setColor4).toHaveBeenCalledWith('myUniform', {
      r: 0.1,
      g: 0.2,
      b: 0.3,
      a: 0.4,
    });
    expect(target.setVector3).toHaveBeenCalledWith('myUniform', {
      x: 1,
      y: 2,
      z: 3,
    });
  });

  it('normalises direction values at bind time', () => {
    const target = createTarget();

    UNIFORM_KIND_SETTERS.direction(
      target,
      binding('direction', { x: 0, y: 3, z: 4 }),
      { resolveTexture: () => null },
    );

    expect(target.setVector3).toHaveBeenCalledWith('myUniform', {
      x: 0,
      y: 0.6,
      z: 0.8,
    });
  });

  it('binds a zero direction as the zero vector instead of NaN', () => {
    const target = createTarget();

    UNIFORM_KIND_SETTERS.direction(
      target,
      binding('direction', { x: 0, y: 0, z: 0 }),
      { resolveTexture: () => null },
    );

    expect(target.setVector3).toHaveBeenCalledWith('myUniform', {
      x: 0,
      y: 0,
      z: 0,
    });
  });

  it('passes position values through raw', () => {
    const target = createTarget();

    UNIFORM_KIND_SETTERS.position(
      target,
      binding('position', { x: 10, y: -2, z: 3.5 }),
      { resolveTexture: () => null },
    );

    expect(target.setVector3).toHaveBeenCalledWith('myUniform', {
      x: 10,
      y: -2,
      z: 3.5,
    });
  });

  it('binds sampler kinds to the texture registered for the definition', () => {
    const target = createTarget();
    const texture = {} as BaseTexture;
    const resolveTexture = vi.fn(() => texture);

    UNIFORM_KIND_SETTERS.sampler2D(
      target,
      binding('sampler2D', { kind: 'url', url: '/a.png' }),
      { resolveTexture },
    );

    expect(resolveTexture).toHaveBeenCalledWith('u1');
    expect(target.setTexture).toHaveBeenCalledWith('myUniform', texture);
  });

  it('skips a sampler whose texture has not loaded yet', () => {
    const target = createTarget();

    UNIFORM_KIND_SETTERS.samplerCube(
      target,
      binding('samplerCube', { kind: 'url', url: '/sky.hdr' }),
      { resolveTexture: () => null },
    );

    expect(target.setTexture).not.toHaveBeenCalled();
  });
});

describe('UniformBinder', () => {
  it('does nothing until a target is attached', () => {
    const { binder } = createBinder();
    const target = createTarget();

    binder.apply(binding('float', 1));
    binder.attach(target);
    binder.apply(binding('float', 2));

    expect(target.setFloat).toHaveBeenCalledTimes(1);
    expect(target.setFloat).toHaveBeenCalledWith('myUniform', 2);
  });

  it('detaches when null is attached', () => {
    const { binder } = createBinder();
    const target = createTarget();

    binder.attach(target);
    binder.attach(null);
    binder.apply(binding('float', 1));

    expect(target.setFloat).not.toHaveBeenCalled();
  });

  it('applies every binding in order', () => {
    const { binder } = createBinder();
    const target = createTarget();
    binder.attach(target);

    binder.applyAll([
      binding('float', 1, 'a', 'u1'),
      binding('color', { r: 1, g: 0, b: 0 }, 'b', 'u2'),
    ]);

    expect(target.setFloat).toHaveBeenCalledWith('a', 1);
    expect(target.setColor3).toHaveBeenCalledWith('b', {
      r: 1,
      g: 0,
      b: 0,
    });
  });

  it('resolves textures through the injected resolver', () => {
    const { binder, textures, texture } = createBinder();
    const target = createTarget();
    binder.attach(target);

    binder.apply(binding('sampler2D', { kind: 'url', url: '/a.png' }, 'map'));

    expect(textures.textureFor).toHaveBeenCalledWith('u1');
    expect(target.setTexture).toHaveBeenCalledWith('map', texture);
  });
});

describe('toUniformBinding', () => {
  it('copies only the fields the binder needs', () => {
    const projected = toUniformBinding({
      id: 'u1',
      name: 'tint',
      kind: 'color',
      value: { r: 1, g: 1, b: 1 },
    });

    expect(projected).toEqual({
      id: 'u1',
      name: 'tint',
      kind: 'color',
      value: { r: 1, g: 1, b: 1 },
    });
  });
});
