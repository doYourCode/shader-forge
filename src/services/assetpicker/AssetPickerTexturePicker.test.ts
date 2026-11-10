// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { App } from 'vue';
import type {
  AssetPickerAdapterFactory,
  AssetPickerApi,
  AssetPickerAppOptions,
  AssetPickerItem,
  AssetPickerItemInput,
} from 'assetpicker';

import type { TexturePickRequest } from '@/services/texturepicker/TexturePicker';

import { AssetPickerTexturePicker } from './AssetPickerTexturePicker';
import {
  REPOSITORY_ADAPTER_ID,
  REPOSITORY_STORAGE_ID,
} from './assetPickerConfig';

interface FakeApp {
  readonly unmount: ReturnType<typeof vi.fn>;
}

function createFakeApi() {
  const apps: FakeApp[] = [];
  const options: AssetPickerAppOptions[] = [];

  const registerAdapter = vi.fn(
    (_type: string, _factory: AssetPickerAdapterFactory): void => undefined,
  );

  const createItem = vi.fn(
    (
      data: AssetPickerItemInput | (() => AssetPickerItemInput),
    ): AssetPickerItem => (typeof data === 'function' ? data() : data),
  );

  const createAssetPickerApp = vi.fn(
    (appOptions: AssetPickerAppOptions): App => {
      options.push(appOptions);
      const app: FakeApp = { unmount: vi.fn() };
      apps.push(app);
      return app as unknown as App;
    },
  );

  const api: AssetPickerApi = {
    createAssetPickerApp,
    registerAdapter,
    createItem,
  };

  return {
    api,
    apps,
    options,
    registerAdapter,
    createAssetPickerApp,
    finish: () => options.at(-1)?.onFinish,
  };
}

function createPicker(
  api: AssetPickerApi,
  language: 'en' | 'de' = 'en',
): AssetPickerTexturePicker {
  return new AssetPickerTexturePicker({
    labels: () => ({
      title: 'Select a texture',
      storage: 'Bundled textures',
    }),
    loadApi: async () => api,
    language: () => language,
  });
}

function createHost(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  return host;
}

const REQUEST: TexturePickRequest = { sampler: 'sampler2D' };

const CHECKER_ITEM: AssetPickerItem = {
  id: 'uv-checker-01',
  storage: REPOSITORY_STORAGE_ID,
  name: 'UV Checker 01',
  type: 'file',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('AssetPickerTexturePicker', () => {
  it('mounts AssetPicker in the supplied host with the requested sampler', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api, 'de');
    const host = createHost();

    const session = picker.open({ sampler: 'samplerCube' }, host);
    await flushPromises();

    expect(fake.createAssetPickerApp).toHaveBeenCalledTimes(1);
    const options = fake.options[0];
    expect(options?.el).toBe(host);
    expect(options?.config.title).toBe('Select a texture');
    expect(options?.config.language).toBe('de');
    expect(options?.config.storages[REPOSITORY_STORAGE_ID]).toMatchObject({
      label: 'Bundled textures',
      sampler: 'samplerCube',
    });

    expect(fake.registerAdapter).toHaveBeenCalledTimes(1);
    expect(fake.registerAdapter.mock.calls[0]?.[0]).toBe(
      REPOSITORY_ADAPTER_ID,
    );

    const registerOrder =
      fake.registerAdapter.mock.invocationCallOrder[0] ?? 0;
    const mountOrder =
      fake.createAssetPickerApp.mock.invocationCallOrder[0] ?? 0;
    expect(registerOrder).toBeLessThan(mountOrder);

    session.dispose();
    await flushPromises();
  });

  it('resolves a picked item as a repository source and unmounts once', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api);
    const session = picker.open(REQUEST, createHost());
    await flushPromises();

    fake.finish()?.(CHECKER_ITEM, false);

    await expect(session.result).resolves.toEqual({
      status: 'picked',
      source: { kind: 'repository', textureId: 'uv-checker-01' },
    });
    expect(fake.apps[0]?.unmount).toHaveBeenCalledTimes(1);
  });

  it('resolves cancellation from AssetPicker', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api);
    const session = picker.open(REQUEST, createHost());
    await flushPromises();

    fake.finish()?.(null, true);

    await expect(session.result).resolves.toEqual({ status: 'cancelled' });
    expect(fake.apps[0]?.unmount).toHaveBeenCalledTimes(1);
  });

  it('ignores a second onFinish call', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api);
    const session = picker.open(REQUEST, createHost());
    await flushPromises();

    const finish = fake.finish();
    if (!finish) throw new Error('onFinish was not supplied');

    finish(CHECKER_ITEM, false);
    finish(null, true);

    await expect(session.result).resolves.toEqual({
      status: 'picked',
      source: { kind: 'repository', textureId: 'uv-checker-01' },
    });
    expect(fake.apps[0]?.unmount).toHaveBeenCalledTimes(1);
  });

  it('never mounts when the session is disposed before the module loads', async () => {
    const fake = createFakeApi();
    const gate = deferred<AssetPickerApi>();
    const picker = new AssetPickerTexturePicker({
      labels: () => ({ title: 'Select a texture', storage: 'Bundled textures' }),
      loadApi: () => gate.promise,
    });

    const session = picker.open(REQUEST, createHost());
    session.dispose();
    gate.resolve(fake.api);
    await flushPromises();

    expect(fake.createAssetPickerApp).not.toHaveBeenCalled();
    await expect(session.result).resolves.toEqual({ status: 'cancelled' });
  });

  it('reports picker-unavailable when the module fails to load', async () => {
    const picker = new AssetPickerTexturePicker({
      labels: () => ({ title: 'Select a texture', storage: 'Bundled textures' }),
      loadApi: () => Promise.reject(new Error('network down')),
    });

    const session = picker.open(REQUEST, createHost());

    await expect(session.result).resolves.toEqual({
      status: 'rejected',
      reason: 'picker-unavailable',
    });
  });

  it('retries the module load after a failure', async () => {
    const fake = createFakeApi();
    let attempts = 0;
    const picker = new AssetPickerTexturePicker({
      labels: () => ({ title: 'Select a texture', storage: 'Bundled textures' }),
      loadApi: () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('first attempt fails'))
          : Promise.resolve(fake.api);
      },
    });

    const first = picker.open(REQUEST, createHost());
    await expect(first.result).resolves.toEqual({
      status: 'rejected',
      reason: 'picker-unavailable',
    });

    const second = picker.open(REQUEST, createHost());
    await flushPromises();

    expect(fake.createAssetPickerApp).toHaveBeenCalledTimes(1);
    second.dispose();
    await flushPromises();
  });

  it('unmounts the active app when the session is disposed and is idempotent', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api);
    const session = picker.open(REQUEST, createHost());
    await flushPromises();

    session.dispose();
    session.dispose();

    await expect(session.result).resolves.toEqual({ status: 'cancelled' });
    expect(fake.apps[0]?.unmount).toHaveBeenCalledTimes(1);
  });

  it('disposing the service cleans up every active session', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api);

    const first = picker.open(REQUEST, createHost());
    await flushPromises();
    const second = picker.open(REQUEST, createHost());
    await flushPromises();

    expect(fake.createAssetPickerApp).toHaveBeenCalledTimes(2);

    picker.dispose();
    picker.dispose();

    await expect(first.result).resolves.toEqual({ status: 'cancelled' });
    await expect(second.result).resolves.toEqual({ status: 'cancelled' });
    for (const app of fake.apps) {
      expect(app.unmount).toHaveBeenCalledTimes(1);
    }
  });
});
