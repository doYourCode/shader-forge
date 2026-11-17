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

import { AssetPickerExamplePicker } from './AssetPickerExamplePicker';
import { EXAMPLE_ADAPTER_ID, EXAMPLE_STORAGE_ID } from './examplePickerConfig';

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
    ): AssetPickerItem =>
      (typeof data === 'function'
        ? data()
        : data) as unknown as AssetPickerItem,
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
): AssetPickerExamplePicker {
  return new AssetPickerExamplePicker({
    labels: () => ({
      title: 'Select a shader example',
      storage: 'Shader examples',
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

const PHONG_ITEM: AssetPickerItem = {
  id: 'phong',
  storage: EXAMPLE_STORAGE_ID,
  name: 'Phong',
  type: 'file',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('AssetPickerExamplePicker', () => {
  it('mounts one storage and registers the example adapter before mounting', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api, 'de');
    const host = createHost();

    const session = picker.open(host);
    await flushPromises();

    expect(fake.createAssetPickerApp).toHaveBeenCalledTimes(1);
    const options = fake.options[0];
    expect(options?.el).toBe(host);
    expect(options?.config.title).toBe('Select a shader example');
    expect(options?.config.language).toBe('de');
    expect(options?.config.storages[EXAMPLE_STORAGE_ID]).toMatchObject({
      label: 'Shader examples',
    });

    expect(fake.registerAdapter).toHaveBeenCalledTimes(1);
    expect(fake.registerAdapter.mock.calls[0]?.[0]).toBe(EXAMPLE_ADAPTER_ID);

    const registerOrder = fake.registerAdapter.mock.invocationCallOrder[0] ?? 0;
    const mountOrder =
      fake.createAssetPickerApp.mock.invocationCallOrder[0] ?? 0;
    expect(registerOrder).toBeLessThan(mountOrder);
    await expect(session.ready).resolves.toBeUndefined();

    session.dispose();
    await flushPromises();
  });

  it('preloads the module once and reuses it for the first open', async () => {
    const fake = createFakeApi();
    let loads = 0;
    const picker = new AssetPickerExamplePicker({
      labels: () => ({ title: 'Examples', storage: 'Examples' }),
      loadApi: async () => {
        loads += 1;
        return fake.api;
      },
    });

    picker.preload();
    await flushPromises();

    expect(loads).toBe(1);
    expect(fake.createAssetPickerApp).not.toHaveBeenCalled();

    const session = picker.open(createHost());
    await flushPromises();

    expect(loads).toBe(1);
    expect(fake.createAssetPickerApp).toHaveBeenCalledTimes(1);

    session.dispose();
    await flushPromises();
  });

  it('resolves a picked example id and unmounts once', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api);
    const session = picker.open(createHost());
    await flushPromises();

    fake.finish()?.(PHONG_ITEM, false);

    await expect(session.result).resolves.toEqual({
      status: 'picked',
      exampleId: 'phong',
    });
    expect(fake.apps[0]?.unmount).toHaveBeenCalledTimes(1);
  });

  it('rejects an item that is not a bundled example', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api);
    const session = picker.open(createHost());
    await flushPromises();

    fake.finish()?.({ ...PHONG_ITEM, id: 'removed-example' }, false);

    await expect(session.result).resolves.toEqual({
      status: 'rejected',
      reason: 'unsupported-example',
    });
  });

  it('resolves cancellation from AssetPicker', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api);
    const session = picker.open(createHost());
    await flushPromises();

    fake.finish()?.(null, true);

    await expect(session.result).resolves.toEqual({ status: 'cancelled' });
    expect(fake.apps[0]?.unmount).toHaveBeenCalledTimes(1);
  });

  it('never mounts when the session is disposed before the module loads', async () => {
    const fake = createFakeApi();
    const gate = deferred<AssetPickerApi>();
    const picker = new AssetPickerExamplePicker({
      labels: () => ({ title: 'Examples', storage: 'Examples' }),
      loadApi: () => gate.promise,
    });

    const session = picker.open(createHost());
    session.dispose();
    gate.resolve(fake.api);
    await flushPromises();

    expect(fake.createAssetPickerApp).not.toHaveBeenCalled();
    await expect(session.result).resolves.toEqual({ status: 'cancelled' });
    await expect(session.ready).resolves.toBeUndefined();
  });

  it('reports picker-unavailable when the module fails to load', async () => {
    const picker = new AssetPickerExamplePicker({
      labels: () => ({ title: 'Examples', storage: 'Examples' }),
      loadApi: () => Promise.reject(new Error('network down')),
    });

    const session = picker.open(createHost());

    await expect(session.result).resolves.toEqual({
      status: 'rejected',
      reason: 'picker-unavailable',
    });
    await expect(session.ready).resolves.toBeUndefined();
  });

  it('disposing the service cleans up every active session', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api);

    const first = picker.open(createHost());
    await flushPromises();
    const second = picker.open(createHost());
    await flushPromises();

    picker.dispose();
    picker.dispose();

    await expect(first.result).resolves.toEqual({ status: 'cancelled' });
    await expect(second.result).resolves.toEqual({ status: 'cancelled' });
    for (const app of fake.apps) {
      expect(app.unmount).toHaveBeenCalledTimes(1);
    }
  });

  it('returns an unavailable session once disposed', async () => {
    const fake = createFakeApi();
    const picker = createPicker(fake.api);
    picker.dispose();

    const session = picker.open(createHost());

    await expect(session.result).resolves.toEqual({
      status: 'rejected',
      reason: 'picker-unavailable',
    });
    expect(fake.createAssetPickerApp).not.toHaveBeenCalled();
  });
});
