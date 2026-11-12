import { describe, expect, it, vi } from 'vitest';
import type { BaseTexture, Scene } from '@babylonjs/core';

import type { PreviewHdri, PreviewHdriFormat } from '@/core/models/previewHdri';
import { EnvironmentController } from './EnvironmentController';

const STUDIO: PreviewHdri = {
  id: 'studio',
  label: 'Wooden Studio 17',
  url: '/studio.hdr',
  format: 'hdr',
};
const PEPPERMINT: PreviewHdri = {
  id: 'peppermint',
  label: 'Peppermint Powerplant',
  url: '/peppermint.hdr',
  format: 'hdr',
};
const BAKED: PreviewHdri = {
  id: 'baked',
  label: 'Baked Studio',
  url: '/baked.env',
  format: 'env',
};

interface FakeTexture {
  readonly url: string;
  readonly format: PreviewHdriFormat;
  readonly dispose: ReturnType<typeof vi.fn>;
}

interface FakeCallbacks {
  readonly onLoad: () => void;
  readonly onError: () => void;
}

function createHarness() {
  const scene = { environmentTexture: null } as unknown as Scene;
  const textures = new Map<string, FakeTexture>();
  const callbacks = new Map<string, FakeCallbacks>();
  const createTexture = vi.fn(
    (
      _scene: Scene,
      url: string,
      format: PreviewHdriFormat,
      onLoad: () => void,
      onError: () => void,
    ): BaseTexture => {
      const texture: FakeTexture = { url, format, dispose: vi.fn() };
      textures.set(url, texture);
      callbacks.set(url, { onLoad, onError });
      return texture as unknown as BaseTexture;
    },
  );
  const background = {
    setTexture: vi.fn(),
    dispose: vi.fn(),
  };
  const createBackground = vi.fn(() => background);
  const filter = { prefilter: vi.fn(async () => {}) };
  const createIblFilter = vi.fn(() => filter);
  const controller = new EnvironmentController(
    scene,
    createTexture,
    createBackground,
    createIblFilter,
  );

  return {
    scene,
    controller,
    createTexture,
    textures,
    callbacks,
    background,
    createBackground,
    filter,
    createIblFilter,
  };
}

function deferred(): {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('EnvironmentController', () => {
  it('applies the texture once it has loaded', async () => {
    const harness = createHarness();

    const loaded = harness.controller.load(STUDIO);
    expect(harness.scene.environmentTexture).toBeNull();
    expect(harness.createBackground).not.toHaveBeenCalled();

    harness.callbacks.get(STUDIO.url)!.onLoad();

    await expect(loaded).resolves.toBe(true);
    expect(harness.createBackground).toHaveBeenCalledTimes(1);
    expect(harness.background.setTexture).toHaveBeenCalledWith(
      harness.textures.get(STUDIO.url),
    );
    expect(harness.scene.environmentTexture).toBe(
      harness.textures.get(STUDIO.url) as unknown as BaseTexture,
    );
  });

  it('keeps the current environment until the next texture loads', async () => {    const harness = createHarness();

    const first = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onLoad();
    await expect(first).resolves.toBe(true);
    const firstTexture = harness.textures.get(STUDIO.url)!;

    const second = harness.controller.load(PEPPERMINT);
    expect(harness.scene.environmentTexture).toBe(
      firstTexture as unknown as BaseTexture,
    );
    expect(firstTexture.dispose).not.toHaveBeenCalled();

    harness.callbacks.get(PEPPERMINT.url)!.onLoad();
    await expect(second).resolves.toBe(true);

    expect(harness.scene.environmentTexture).toBe(
      harness.textures.get(PEPPERMINT.url),
    );
    expect(harness.background.setTexture).toHaveBeenCalledTimes(2);
    expect(harness.background.setTexture).toHaveBeenLastCalledWith(
      harness.textures.get(PEPPERMINT.url),
    );
    expect(firstTexture.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps the last successful environment when a load fails', async () => {
    const harness = createHarness();

    const first = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onLoad();
    await first;
    const firstTexture = harness.textures.get(STUDIO.url)!;

    const failed = harness.controller.load(PEPPERMINT);
    harness.callbacks.get(PEPPERMINT.url)!.onError();

    await expect(failed).resolves.toBe(false);
    expect(harness.scene.environmentTexture).toBe(
      firstTexture as unknown as BaseTexture,
    );
    expect(harness.background.setTexture).toHaveBeenCalledTimes(1);
    expect(firstTexture.dispose).not.toHaveBeenCalled();
    expect(harness.textures.get(PEPPERMINT.url)!.dispose).toHaveBeenCalledTimes(
      1,
    );
  });

  it('does not reload the active environment', async () => {
    const harness = createHarness();

    const first = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onLoad();
    await first;

    await expect(harness.controller.load(STUDIO)).resolves.toBe(true);
    expect(harness.createTexture).toHaveBeenCalledTimes(1);
    expect(harness.createBackground).toHaveBeenCalledTimes(1);
    expect(harness.background.setTexture).toHaveBeenCalledTimes(1);
  });

  it('lets the latest of several rapid selections win', async () => {
    const harness = createHarness();

    const first = harness.controller.load(STUDIO);
    const second = harness.controller.load(PEPPERMINT);

    await expect(first).resolves.toBe(false);
    expect(harness.textures.get(STUDIO.url)!.dispose).toHaveBeenCalledTimes(1);

    // A stale callback must not override the newer selection.
    harness.callbacks.get(STUDIO.url)!.onLoad();
    harness.callbacks.get(PEPPERMINT.url)!.onLoad();

    await expect(second).resolves.toBe(true);
    expect(harness.scene.environmentTexture).toBe(
      harness.textures.get(PEPPERMINT.url),
    );
    expect(harness.textures.get(PEPPERMINT.url)!.dispose).not.toHaveBeenCalled();
  });

  it('cancels a pending swap when the active environment is selected again', async () => {
    const harness = createHarness();

    const first = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onLoad();
    await first;
    const studioTexture = harness.textures.get(STUDIO.url)!;

    const pending = harness.controller.load(PEPPERMINT);
    await expect(harness.controller.load(STUDIO)).resolves.toBe(true);

    expect(harness.textures.get(PEPPERMINT.url)!.dispose).toHaveBeenCalledTimes(
      1,
    );
    await expect(pending).resolves.toBe(false);

    harness.callbacks.get(PEPPERMINT.url)!.onLoad();
    expect(harness.scene.environmentTexture).toBe(
      studioTexture as unknown as BaseTexture,
    );
  });

  it('treats a texture factory failure as a failed load', async () => {
    const harness = createHarness();

    const first = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onLoad();
    await first;
    const studioTexture = harness.textures.get(STUDIO.url)!;

    harness.createTexture.mockImplementationOnce(() => {
      throw new Error('invalid HDR');
    });

    await expect(harness.controller.load(PEPPERMINT)).resolves.toBe(false);
    expect(harness.scene.environmentTexture).toBe(
      studioTexture as unknown as BaseTexture,
    );
    expect(studioTexture.dispose).not.toHaveBeenCalled();
  });

  it('keeps the preview usable when the first environment fails', async () => {
    const harness = createHarness();

    const failed = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onError();

    await expect(failed).resolves.toBe(false);
    expect(harness.scene.environmentTexture).toBeNull();

    const retry = harness.controller.load(PEPPERMINT);
    harness.callbacks.get(PEPPERMINT.url)!.onLoad();
    await expect(retry).resolves.toBe(true);
    expect(harness.scene.environmentTexture).toBe(
      harness.textures.get(PEPPERMINT.url),
    );
  });

  it('disposes every texture and clears the scene on dispose', async () => {
    const harness = createHarness();

    const first = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onLoad();
    await first;
    const firstTexture = harness.textures.get(STUDIO.url)!;

    const pending = harness.controller.load(PEPPERMINT);
    const pendingTexture = harness.textures.get(PEPPERMINT.url)!;

    harness.controller.dispose();

    expect(harness.scene.environmentTexture).toBeNull();
    expect(harness.background.dispose).toHaveBeenCalledTimes(1);
    expect(firstTexture.dispose).toHaveBeenCalledTimes(1);
    expect(pendingTexture.dispose).toHaveBeenCalledTimes(1);
    await expect(pending).resolves.toBe(false);

    harness.callbacks.get(PEPPERMINT.url)!.onLoad();
    expect(harness.scene.environmentTexture).toBeNull();
    await expect(harness.controller.load(STUDIO)).resolves.toBe(false);
  });

  it('publishes the environment only after IBL filtering completes', async () => {
    const harness = createHarness();
    const gate = deferred();
    harness.filter.prefilter.mockReturnValueOnce(gate.promise);

    const loaded = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onLoad();
    await flush();

    expect(harness.filter.prefilter).toHaveBeenCalledWith(
      harness.textures.get(STUDIO.url),
    );
    expect(harness.scene.environmentTexture).toBeNull();
    expect(harness.background.setTexture).not.toHaveBeenCalled();

    gate.resolve();
    await expect(loaded).resolves.toBe(true);
    expect(harness.scene.environmentTexture).toBe(
      harness.textures.get(STUDIO.url),
    );
  });

  it('keeps the current environment when IBL filtering fails', async () => {
    const harness = createHarness();

    const first = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onLoad();
    await first;
    const studioTexture = harness.textures.get(STUDIO.url)!;

    const failing = deferred();
    harness.filter.prefilter.mockReturnValueOnce(failing.promise);

    const second = harness.controller.load(PEPPERMINT);
    harness.callbacks.get(PEPPERMINT.url)!.onLoad();
    await flush();
    failing.reject(new Error('filter failed'));

    await expect(second).resolves.toBe(false);
    expect(harness.scene.environmentTexture).toBe(
      studioTexture as unknown as BaseTexture,
    );
    expect(harness.scene.environmentTexture).not.toBe(
      harness.textures.get(PEPPERMINT.url),
    );
    expect(harness.textures.get(PEPPERMINT.url)!.dispose).toHaveBeenCalledTimes(
      1,
    );
    expect(studioTexture.dispose).not.toHaveBeenCalled();
  });

  it('disposes a superseded texture only after its filtering settles', async () => {
    const harness = createHarness();
    const firstGate = deferred();
    harness.filter.prefilter.mockReturnValueOnce(firstGate.promise);

    const first = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onLoad();
    await flush();
    const studioTexture = harness.textures.get(STUDIO.url)!;

    const second = harness.controller.load(PEPPERMINT);
    await expect(first).resolves.toBe(false);
    expect(studioTexture.dispose).not.toHaveBeenCalled();

    firstGate.resolve();
    await flush();
    expect(studioTexture.dispose).toHaveBeenCalledTimes(1);

    harness.callbacks.get(PEPPERMINT.url)!.onLoad();
    await expect(second).resolves.toBe(true);
  });

  it('does not start filtering for a selection superseded before load', async () => {
    const harness = createHarness();

    const first = harness.controller.load(STUDIO);
    harness.callbacks.get(STUDIO.url)!.onLoad();
    await first;

    const pending = harness.controller.load(PEPPERMINT);
    await expect(harness.controller.load(STUDIO)).resolves.toBe(true);

    harness.callbacks.get(PEPPERMINT.url)!.onLoad();
    await expect(pending).resolves.toBe(false);

    expect(harness.filter.prefilter).not.toHaveBeenCalledWith(
      harness.textures.get(PEPPERMINT.url),
    );
  });

  it('publishes a prefiltered .env without running the HDR filters', async () => {
    const harness = createHarness();

    const loaded = harness.controller.load(BAKED);
    harness.callbacks.get(BAKED.url)!.onLoad();

    await expect(loaded).resolves.toBe(true);
    expect(harness.filter.prefilter).not.toHaveBeenCalled();
    expect(harness.createIblFilter).not.toHaveBeenCalled();
    expect(harness.scene.environmentTexture).toBe(
      harness.textures.get(BAKED.url) as unknown as BaseTexture,
    );
    expect(harness.background.setTexture).toHaveBeenCalledWith(
      harness.textures.get(BAKED.url),
    );
  });

  it('passes the declared asset format to the texture factory', async () => {
    const harness = createHarness();

    harness.controller.load(BAKED);
    harness.callbacks.get(BAKED.url)!.onLoad();
    await flush();

    expect(harness.createTexture).toHaveBeenCalledWith(
      harness.scene,
      BAKED.url,
      'env',
      expect.any(Function),
      expect.any(Function),
    );
    expect(harness.textures.get(BAKED.url)!.format).toBe('env');
  });
});
