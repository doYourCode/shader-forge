import { describe, expect, it, vi } from 'vitest';
import type { BaseTexture, Scene } from '@babylonjs/core';

import type { SamplerKind } from '@/core/models/userUniform';
import {
  TextureRegistry,
  type ObjectUrlProvider,
  type UserTextureFactory,
} from './TextureRegistry';

interface FakeTexture {
  readonly url: string;
  readonly dispose: ReturnType<typeof vi.fn>;
}

interface FakeCallbacks {
  readonly onLoad: () => void;
  readonly onError: () => void;
}

function createHarness() {
  const scene = {} as Scene;
  const textures = new Map<string, FakeTexture>();
  const callbacks = new Map<string, FakeCallbacks>();
  const createTexture: UserTextureFactory = vi.fn(
    (_scene, _kind, url, onLoad, onError) => {
      const texture: FakeTexture = { url, dispose: vi.fn() };
      textures.set(url, texture);
      callbacks.set(url, { onLoad, onError });
      return texture as unknown as BaseTexture;
    },
  );
  const objectUrls: ObjectUrlProvider = {
    createObjectUrl: vi.fn(() => 'blob:user-file'),
    revokeObjectUrl: vi.fn(),
  };
  const registry = new TextureRegistry(scene, createTexture, objectUrls);

  return { registry, createTexture, textures, callbacks, objectUrls };
}

async function loadUrl(
  harness: ReturnType<typeof createHarness>,
  definitionId: string,
  url: string,
  kind: SamplerKind = 'sampler2D',
) {
  const promise = harness.registry.load(definitionId, kind, {
    kind: 'url',
    url,
  });
  harness.callbacks.get(url)!.onLoad();
  return promise;
}

describe('TextureRegistry', () => {
  it('resolves with the texture once it has loaded', async () => {
    const harness = createHarness();

    const loaded = harness.registry.load('u1', 'sampler2D', {
      kind: 'url',
      url: '/albedo.png',
    });

    expect(harness.registry.textureFor('u1')).toBeNull();

    harness.callbacks.get('/albedo.png')!.onLoad();

    await expect(loaded).resolves.toBe(
      harness.textures.get('/albedo.png') as unknown as BaseTexture,
    );
    expect(harness.registry.textureFor('u1')).toBe(
      harness.textures.get('/albedo.png') as unknown as BaseTexture,
    );
    expect(harness.createTexture).toHaveBeenCalledWith(
      expect.anything(),
      'sampler2D',
      '/albedo.png',
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('uses the sampler kind to pick the texture class', async () => {
    const harness = createHarness();

    await loadUrl(harness, 'u1', '/sky.hdr', 'samplerCube');

    expect(harness.createTexture).toHaveBeenCalledWith(
      expect.anything(),
      'samplerCube',
      '/sky.hdr',
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('keeps the previous texture until the next one has loaded', async () => {
    const harness = createHarness();
    await loadUrl(harness, 'u1', '/first.png');
    const firstTexture = harness.textures.get('/first.png')!;

    const pending = harness.registry.load('u1', 'sampler2D', {
      kind: 'url',
      url: '/second.png',
    });

    expect(harness.registry.textureFor('u1')).toBe(
      firstTexture as unknown as BaseTexture,
    );
    expect(firstTexture.dispose).not.toHaveBeenCalled();

    harness.callbacks.get('/second.png')!.onLoad();

    await expect(pending).resolves.toBe(
      harness.textures.get('/second.png') as unknown as BaseTexture,
    );
    expect(firstTexture.dispose).toHaveBeenCalledTimes(1);
  });

  it('lets the latest of several rapid requests win', async () => {
    const harness = createHarness();

    const first = harness.registry.load('u1', 'sampler2D', {
      kind: 'url',
      url: '/first.png',
    });
    const second = harness.registry.load('u1', 'sampler2D', {
      kind: 'url',
      url: '/second.png',
    });

    await expect(first).resolves.toBeNull();
    expect(harness.textures.get('/first.png')!.dispose).toHaveBeenCalledTimes(1);

    // A stale callback must not override the newer registration.
    harness.callbacks.get('/first.png')!.onLoad();
    harness.callbacks.get('/second.png')!.onLoad();

    await expect(second).resolves.toBe(
      harness.textures.get('/second.png') as unknown as BaseTexture,
    );
    expect(harness.registry.textureFor('u1')).toBe(
      harness.textures.get('/second.png') as unknown as BaseTexture,
    );
  });

  it('treats a failed load as no texture and disposes the attempt', async () => {
    const harness = createHarness();

    const failed = harness.registry.load('u1', 'sampler2D', {
      kind: 'url',
      url: '/broken.png',
    });
    harness.callbacks.get('/broken.png')!.onError();

    await expect(failed).resolves.toBeNull();
    expect(harness.registry.textureFor('u1')).toBeNull();
    expect(harness.textures.get('/broken.png')!.dispose).toHaveBeenCalledTimes(
      1,
    );
  });

  it('treats a factory failure as a failed load', async () => {
    const harness = createHarness();
    vi.mocked(harness.createTexture).mockImplementationOnce(() => {
      throw new Error('unreadable image');
    });

    await expect(
      harness.registry.load('u1', 'sampler2D', {
        kind: 'url',
        url: '/broken.png',
      }),
    ).resolves.toBeNull();
    expect(harness.registry.textureFor('u1')).toBeNull();
  });

  it('ignores an empty URL and creates no texture', async () => {
    const harness = createHarness();

    await expect(
      harness.registry.load('u1', 'sampler2D', { kind: 'url', url: '   ' }),
    ).resolves.toBeNull();
    expect(harness.createTexture).not.toHaveBeenCalled();
  });

  it('reuses the loaded texture when the same URL is requested again', async () => {
    const harness = createHarness();
    await loadUrl(harness, 'u1', '/albedo.png');

    const again = harness.registry.load('u1', 'sampler2D', {
      kind: 'url',
      url: '/albedo.png',
    });

    await expect(again).resolves.toBe(
      harness.textures.get('/albedo.png') as unknown as BaseTexture,
    );
    expect(harness.createTexture).toHaveBeenCalledTimes(1);
  });

  it('creates and revokes an ObjectURL for uploaded files', async () => {
    const harness = createHarness();
    const file = new File([], 'albedo.png');

    const loaded = harness.registry.load('u1', 'sampler2D', {
      kind: 'file',
      file,
    });
    harness.callbacks.get('blob:user-file')!.onLoad();
    await loaded;

    expect(harness.objectUrls.createObjectUrl).toHaveBeenCalledWith(file);
    expect(harness.objectUrls.revokeObjectUrl).not.toHaveBeenCalled();

    harness.registry.release('u1');

    expect(harness.textures.get('blob:user-file')!.dispose).toHaveBeenCalledTimes(
      1,
    );
    expect(harness.objectUrls.revokeObjectUrl).toHaveBeenCalledTimes(1);
    expect(harness.objectUrls.revokeObjectUrl).toHaveBeenCalledWith(
      'blob:user-file',
    );
  });

  it('disposes a released texture exactly once', async () => {
    const harness = createHarness();
    await loadUrl(harness, 'u1', '/albedo.png');
    const texture = harness.textures.get('/albedo.png')!;

    harness.registry.release('u1');
    harness.registry.release('u1');

    expect(texture.dispose).toHaveBeenCalledTimes(1);
    expect(harness.registry.textureFor('u1')).toBeNull();
  });

  it('cancels a pending entry when its definition is released', async () => {
    const harness = createHarness();

    const pending = harness.registry.load('u1', 'sampler2D', {
      kind: 'url',
      url: '/pending.png',
    });
    harness.registry.release('u1');
    harness.callbacks.get('/pending.png')!.onLoad();

    await expect(pending).resolves.toBeNull();
    expect(harness.textures.get('/pending.png')!.dispose).toHaveBeenCalledTimes(
      1,
    );
    expect(harness.registry.textureFor('u1')).toBeNull();
  });

  it('disposes every texture and settles pending loads on dispose', async () => {
    const harness = createHarness();
    await loadUrl(harness, 'u1', '/first.png');
    const firstTexture = harness.textures.get('/first.png')!;

    const pending = harness.registry.load('u2', 'sampler2D', {
      kind: 'url',
      url: '/second.png',
    });
    const secondTexture = harness.textures.get('/second.png')!;

    harness.registry.dispose();

    expect(firstTexture.dispose).toHaveBeenCalledTimes(1);
    expect(secondTexture.dispose).toHaveBeenCalledTimes(1);
    await expect(pending).resolves.toBeNull();

    harness.callbacks.get('/second.png')!.onLoad();
    expect(harness.registry.textureFor('u2')).toBeNull();
    await expect(
      harness.registry.load('u3', 'sampler2D', { kind: 'url', url: '/x.png' }),
    ).resolves.toBeNull();
  });
});
