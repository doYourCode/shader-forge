import { describe, expect, it, vi } from 'vitest';
import type { BaseTexture } from '@babylonjs/core';

import {
  UserDataController,
  type UserDataControllerDeps,
} from './UserDataController';
import type { UniformBindingTarget } from './UniformBinder';

const VERTEX = `#version 300 es
precision highp float;
void main() {}`;

const FRAGMENT = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(1.0);
}`;

function createScheduler() {
  let pending: (() => void) | null = null;
  const delays: number[] = [];
  const schedule = vi.fn((callback: () => void, delayMs: number) => {
    delays.push(delayMs);
    pending = callback;
    return () => {
      if (pending === callback) pending = null;
    };
  });

  return {
    schedule,
    delays,
    flush(): void {
      const callback = pending;
      pending = null;
      callback?.();
    },
  };
}

function createHarness(
  overrides: Partial<UserDataControllerDeps> = {},
) {
  const scheduler = createScheduler();
  const onCompileRequested = vi.fn();
  const texture = { dispose: vi.fn() } as unknown as BaseTexture;
  const textures = {
    load: vi.fn(async () => texture as BaseTexture | null),
    release: vi.fn(),
    textureFor: vi.fn(() => texture as BaseTexture | null),
    dispose: vi.fn(),
  };
  const binder = {
    attach: vi.fn(),
    apply: vi.fn(),
    applyAll: vi.fn(),
  };
  const sources = { vertex: VERTEX, fragment: FRAGMENT };
  const controller = new UserDataController({
    getSources: () => sources,
    onCompileRequested,
    debounceMs: 300,
    schedule: scheduler.schedule,
    ...overrides,
  });
  controller.attachGpu({ textures, binder });

  return {
    controller,
    scheduler,
    onCompileRequested,
    textures,
    binder,
    texture,
    sources,
  };
}

function addColor(controller: UserDataController, name = 'tint'): string {
  const result = controller.add({ name, kind: 'color' });
  if (!result.ok) throw new Error('expected the definition to be added');
  return result.definition.id;
}

describe('UserDataController structural commands', () => {
  it('adds a definition with its kind default and requests a debounced compile', () => {
    const harness = createHarness();

    const result = harness.controller.add({ name: 'tint', kind: 'color' });

    expect(result.ok).toBe(true);
    expect(harness.controller.doc.definitions).toHaveLength(1);
    expect(harness.controller.doc.revision).toBe(1);
    expect(harness.controller.doc.definitions[0]?.value).toEqual({
      r: 1,
      g: 1,
      b: 1,
    });
    expect(harness.controller.doc.definitions[0]?.stages).toBe('fragment');

    expect(harness.scheduler.delays).toEqual([300]);
    expect(harness.onCompileRequested).not.toHaveBeenCalled();

    harness.scheduler.flush();

    expect(harness.onCompileRequested).toHaveBeenCalledTimes(1);
    const blueprint = harness.onCompileRequested.mock.calls[0]![0];
    expect(blueprint.extraUniforms).toEqual(['tint']);
    expect(blueprint.extraSamplers).toEqual([]);
    expect(blueprint.fragment).toContain('uniform vec3 tint; // color (RGB)');
    expect(blueprint.fragment).toContain('// current values: tint = (1, 1, 1)');
  });

  it('rejects invalid, reserved and duplicate names before touching the GPU', () => {
    const harness = createHarness();
    addColor(harness.controller, 'existing');
    harness.scheduler.flush();
    harness.onCompileRequested.mockClear();

    for (const name of ['', '1bad', 'has space', 'uniform', 'time', 'existing']) {
      const result = harness.controller.add({ name, kind: 'float' });
      expect(result.ok).toBe(false);
    }

    expect(harness.controller.doc.definitions).toHaveLength(1);
    expect(harness.controller.doc.revision).toBe(1);
    expect(harness.binder.apply).not.toHaveBeenCalled();
    expect(harness.textures.load).not.toHaveBeenCalled();

    harness.scheduler.flush();
    expect(harness.onCompileRequested).not.toHaveBeenCalled();
  });

  it('renames a definition and allows keeping its own name', () => {
    const harness = createHarness();
    const id = addColor(harness.controller);
    harness.scheduler.flush();
    harness.onCompileRequested.mockClear();

    expect(harness.controller.rename(id, 'accent').ok).toBe(true);
    expect(harness.controller.doc.definitions[0]?.name).toBe('accent');

    // Renaming to the current name is a no-op, not a duplicate error.
    expect(harness.controller.rename(id, 'accent').ok).toBe(true);

    expect(harness.controller.rename(id, 'time').ok).toBe(false);
    expect(harness.controller.doc.definitions[0]?.name).toBe('accent');

    harness.scheduler.flush();
    const blueprint = harness.onCompileRequested.mock.calls[0]![0];
    expect(blueprint.fragment).toContain('uniform vec3 accent; // color (RGB)');
  });

  it('releases a removed sampler texture once the rebuilt material is applied', () => {
    const harness = createHarness();
    const result = harness.controller.add({
      name: 'albedo',
      kind: 'sampler2D',
    });
    if (!result.ok) throw new Error('expected add to succeed');
    const id = result.definition.id;
    harness.scheduler.flush();
    harness.textures.load.mockClear();
    harness.textures.release.mockClear();
    harness.scheduler.delays.length = 0;

    harness.controller.remove(id);
    expect(harness.controller.doc.definitions).toHaveLength(0);
    // The live material still references the texture, so disposal waits for
    // the recompiled material to replace it.
    expect(harness.textures.release).not.toHaveBeenCalled();

    harness.controller.onMaterialApplied({} as UniformBindingTarget);
    expect(harness.textures.release).toHaveBeenCalledWith(id);

    harness.scheduler.flush();
    expect(harness.onCompileRequested).toHaveBeenCalledTimes(2);
  });

  it('does not release anything when removing a non-sampler definition', () => {
    const harness = createHarness();
    const id = addColor(harness.controller);
    harness.textures.release.mockClear();

    harness.controller.remove(id);

    expect(harness.textures.release).not.toHaveBeenCalled();
  });

  it('releases the old texture after a kind change is applied', () => {
    const harness = createHarness();
    const result = harness.controller.add({
      name: 'map',
      kind: 'sampler2D',
    });
    if (!result.ok) throw new Error('expected add to succeed');
    const id = result.definition.id;
    harness.textures.load.mockClear();
    harness.textures.release.mockClear();

    expect(harness.controller.changeKind(id, 'samplerCube').ok).toBe(true);

    expect(harness.controller.doc.definitions[0]?.kind).toBe('samplerCube');
    expect(harness.textures.release).not.toHaveBeenCalled();

    harness.controller.onMaterialApplied({} as UniformBindingTarget);
    expect(harness.textures.release).toHaveBeenCalledWith(id);
    // The default source is empty, so there is nothing to load yet.
    expect(harness.textures.load).not.toHaveBeenCalled();
  });

  it('turns a non-sampler into a sampler without keeping the old value', () => {
    const harness = createHarness();
    const id = addColor(harness.controller);
    harness.textures.release.mockClear();

    harness.controller.changeKind(id, 'sampler2D');

    expect(harness.controller.doc.definitions[0]?.value).toEqual({
      kind: 'url',
      url: '',
    });
    // There was no texture to release for a colour uniform.
    expect(harness.textures.release).not.toHaveBeenCalled();
  });

  it('does not dispose a texture that started loading after a queued release', () => {
    const harness = createHarness();
    const result = harness.controller.add({
      name: 'map',
      kind: 'sampler2D',
    });
    if (!result.ok) throw new Error('expected add to succeed');
    const id = result.definition.id;
    harness.textures.release.mockClear();

    harness.controller.changeKind(id, 'float');
    harness.controller.changeKind(id, 'sampler2D');
    harness.controller.setValue(id, { kind: 'url', url: '/new.png' });
    harness.controller.onMaterialApplied({} as UniformBindingTarget);

    expect(harness.textures.release).not.toHaveBeenCalledWith(id);
  });

  it('requests a recompile when the stage targeting changes', () => {
    const harness = createHarness();
    const id = addColor(harness.controller);
    harness.scheduler.flush();
    harness.onCompileRequested.mockClear();

    expect(harness.controller.changeStages(id, 'vertex').ok).toBe(true);
    expect(harness.controller.doc.definitions[0]?.stages).toBe('vertex');

    harness.scheduler.flush();
    const blueprint = harness.onCompileRequested.mock.calls[0]![0];
    expect(blueprint.vertex).toContain('uniform vec3 tint; // color (RGB)');
    expect(blueprint.fragment).not.toContain('uniform vec3 tint; // color (RGB)');
  });

  it('collapses several structural edits into one compile', () => {
    const harness = createHarness();

    addColor(harness.controller, 'a');
    addColor(harness.controller, 'b');
    addColor(harness.controller, 'c');

    harness.scheduler.flush();

    expect(harness.onCompileRequested).toHaveBeenCalledTimes(1);
    const blueprint = harness.onCompileRequested.mock.calls[0]![0];
    expect(blueprint.extraUniforms).toEqual(['a', 'b', 'c']);
  });
});

describe('UserDataController value command', () => {
  it('binds edited values live and never recompiles', () => {
    const harness = createHarness();
    const id = addColor(harness.controller);
    harness.scheduler.flush();
    harness.onCompileRequested.mockClear();
    harness.binder.apply.mockClear();

    expect(
      harness.controller.setValue(id, { r: 0, g: 0.5, b: 1 }).ok,
    ).toBe(true);

    expect(harness.binder.apply).toHaveBeenCalledWith({
      id,
      name: 'tint',
      kind: 'color',
      value: { r: 0, g: 0.5, b: 1 },
    });
    expect(harness.controller.doc.revision).toBe(2);

    harness.scheduler.flush();
    expect(harness.onCompileRequested).not.toHaveBeenCalled();

    // Declarations are unchanged; only the values comment is refreshed.
    const blueprint = harness.controller.buildBlueprint();
    expect(blueprint.extraUniforms).toEqual(['tint']);
    expect(blueprint.fragment).toContain('uniform vec3 tint; // color (RGB)');
    expect(blueprint.fragment).toContain(
      '// current values: tint = (0, 0.5, 1)',
    );
  });

  it('rejects values whose shape does not match the kind', () => {
    const harness = createHarness();
    const id = addColor(harness.controller);
    harness.binder.apply.mockClear();

    const result = harness.controller.setValue(id, 2 as never);

    expect(result.ok).toBe(false);
    expect(harness.binder.apply).not.toHaveBeenCalled();
  });

  it('loads a texture from a URL and binds it once loaded', async () => {
    const harness = createHarness();
    const result = harness.controller.add({
      name: 'albedo',
      kind: 'sampler2D',
    });
    if (!result.ok) throw new Error('expected add to succeed');
    const id = result.definition.id;
    harness.textures.load.mockClear();
    harness.binder.apply.mockClear();

    harness.controller.setValue(id, { kind: 'url', url: '/albedo.png' });
    await Promise.resolve();

    expect(harness.textures.load).toHaveBeenCalledWith(id, 'sampler2D', {
      kind: 'url',
      url: '/albedo.png',
    });
    expect(harness.binder.apply).toHaveBeenCalledWith({
      id,
      name: 'albedo',
      kind: 'sampler2D',
      value: { kind: 'url', url: '/albedo.png' },
    });
  });

  it('keeps the loaded texture when the source is cleared so the live material stays ready', () => {
    const harness = createHarness();
    const result = harness.controller.add({
      name: 'albedo',
      kind: 'sampler2D',
    });
    if (!result.ok) throw new Error('expected add to succeed');
    const id = result.definition.id;
    harness.textures.release.mockClear();

    harness.controller.setValue(id, { kind: 'url', url: '' });

    // Disposing a texture the live material still references would blank the
    // preview; the value is simply not re-bound.
    expect(harness.textures.release).not.toHaveBeenCalled();

    harness.binder.applyAll.mockClear();
    harness.controller.onMaterialApplied({} as UniformBindingTarget);
    const bindings = harness.binder.applyAll.mock.calls[0]![0];
    expect(
      bindings.map((binding: { name: string }) => binding.name),
    ).not.toContain('albedo');
  });

  it('does nothing when no scene is attached', () => {
    const harness = createHarness();
    const id = addColor(harness.controller);
    harness.controller.attachGpu(null);
    harness.binder.apply.mockClear();

    expect(harness.controller.setValue(id, { r: 0, g: 0, b: 0 }).ok).toBe(
      true,
    );
    expect(harness.binder.apply).not.toHaveBeenCalled();
  });
});

describe('UserDataController material binding', () => {
  it('attaches the target and re-applies every current value', () => {
    const harness = createHarness();
    addColor(harness.controller, 'tint');
    addColor(harness.controller, 'accent');
    harness.binder.attach.mockClear();
    harness.binder.applyAll.mockClear();
    const target = {} as UniformBindingTarget;

    harness.controller.onMaterialApplied(target);

    expect(harness.binder.attach).toHaveBeenCalledWith(target);
    const bindings = harness.binder.applyAll.mock.calls[0]![0];
    expect(bindings.map((binding: { name: string }) => binding.name)).toEqual([
      'tint',
      'accent',
    ]);
  });

  it('detaches by attaching null', () => {
    const harness = createHarness();

    harness.controller.onMaterialApplied(null);

    expect(harness.binder.attach).toHaveBeenCalledWith(null);
  });

  it('loads textures for sampler definitions when the scene attaches', () => {
    const harness = createHarness();
    harness.controller.add({ name: 'albedo', kind: 'sampler2D' });
    const id = harness.controller.doc.definitions[0]!.id;
    harness.controller.setValue(id, { kind: 'url', url: '/albedo.png' });
    harness.textures.load.mockClear();

    harness.controller.attachGpu({
      textures: harness.textures,
      binder: harness.binder,
    });

    expect(harness.textures.load).toHaveBeenCalledWith(id, 'sampler2D', {
      kind: 'url',
      url: '/albedo.png',
    });
  });
});

describe('UserDataController lifecycle', () => {
  it('cancels a pending recompile on dispose', () => {
    const harness = createHarness();
    addColor(harness.controller);

    harness.controller.dispose();
    harness.scheduler.flush();

    expect(harness.onCompileRequested).not.toHaveBeenCalled();
  });

  it('keeps the document after dispose', () => {
    const harness = createHarness();
    addColor(harness.controller);

    harness.controller.dispose();

    expect(harness.controller.doc.definitions).toHaveLength(1);
  });
});
