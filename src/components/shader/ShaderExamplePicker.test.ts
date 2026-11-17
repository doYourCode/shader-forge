// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import { i18n } from '@/i18n';
import type {
  ExamplePickerPort,
  ExamplePickerSession,
  ExamplePickResult,
} from '@/services/examplepicker/ExamplePicker';

import ShaderExamplePicker from './ShaderExamplePicker.vue';
import { EXAMPLE_PICKER } from './examplePickerContext';

interface FakeSession {
  readonly session: ExamplePickerSession;
  readonly resolve: (result: ExamplePickResult) => void;
  readonly markReady: () => void;
  readonly dispose: ReturnType<typeof vi.fn>;
}

function createFakePicker() {
  const sessions: FakeSession[] = [];
  const preload = vi.fn();

  const open = vi.fn((_host: HTMLElement): ExamplePickerSession => {
    let resolve!: (result: ExamplePickResult) => void;
    const result = new Promise<ExamplePickResult>((resolvePromise) => {
      resolve = resolvePromise;
    });

    let markReady!: () => void;
    const ready = new Promise<void>((resolvePromise) => {
      markReady = resolvePromise;
    });

    const dispose = vi.fn(() => {
      resolve({ status: 'cancelled' });
      markReady();
    });
    const session: ExamplePickerSession = { result, ready, dispose };

    sessions.push({ session, resolve, markReady, dispose });
    return session;
  });

  const picker: ExamplePickerPort = { preload, open };

  return {
    picker,
    open,
    preload,
    sessions,
    lastSession: () => {
      const last = sessions.at(-1);
      if (!last) throw new Error('no picker session was opened');
      return last;
    },
  };
}

function mountPicker() {
  const fake = createFakePicker();

  const wrapper = mount(ShaderExamplePicker, {
    global: {
      plugins: [i18n],
      provide: { [EXAMPLE_PICKER]: fake.picker },
    },
    attachTo: document.body,
  });

  return { wrapper, fake };
}

async function openDialog(wrapper: ReturnType<typeof mountPicker>['wrapper']) {
  await wrapper.find('.example-picker__trigger').trigger('click');
  await flushPromises();
}

beforeEach(() => {
  i18n.global.locale.value = 'en';
  document.body.style.overflow = '';
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ShaderExamplePicker', () => {
  it('preloads on hover and focus without opening a session', async () => {
    const { wrapper, fake } = mountPicker();
    const trigger = wrapper.find('.example-picker__trigger');

    await trigger.trigger('pointerenter');
    await trigger.trigger('focus');

    expect(fake.preload).toHaveBeenCalledTimes(2);
    expect(fake.open).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('opens the picker in a modal host', async () => {
    const { wrapper, fake } = mountPicker();

    await openDialog(wrapper);

    expect(fake.open).toHaveBeenCalledTimes(1);
    const host = fake.open.mock.calls[0]?.[0];
    expect(host).toBeInstanceOf(HTMLElement);
    expect(host?.isConnected).toBe(true);

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(true);
    expect(
      wrapper.find('.example-picker__trigger').attributes('disabled'),
    ).toBeDefined();

    wrapper.unmount();

    expect(document.body.style.overflow).toBe('');
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false);
  });

  it('shows a loading state until the picker reports ready', async () => {
    const { wrapper, fake } = mountPicker();
    await openDialog(wrapper);

    const loading = document.querySelector('.example-picker__loading');
    expect(loading).not.toBeNull();
    expect(loading?.textContent).toContain('Loading examples');

    fake.lastSession().markReady();
    await flushPromises();

    expect(document.querySelector('.example-picker__loading')).toBeNull();

    wrapper.unmount();
  });

  it('emits the picked example and restores the background', async () => {
    const { wrapper, fake } = mountPicker();
    await openDialog(wrapper);

    fake.lastSession().resolve({ status: 'picked', exampleId: 'phong' });
    await flushPromises();

    expect(wrapper.emitted('pick')?.[0]).toEqual(['phong']);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');

    wrapper.unmount();
  });

  it('emits nothing when the picker is cancelled', async () => {
    const { wrapper, fake } = mountPicker();
    await openDialog(wrapper);

    fake.lastSession().resolve({ status: 'cancelled' });
    await flushPromises();

    expect(wrapper.emitted('pick')).toBeUndefined();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    wrapper.unmount();
  });

  it('keeps the dialog open and explains an unusable example', async () => {
    const { wrapper, fake } = mountPicker();
    await openDialog(wrapper);

    fake.lastSession().resolve({
      status: 'rejected',
      reason: 'unsupported-example',
    });
    await flushPromises();

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    const alert = document.querySelector('.example-picker__error');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent?.trim()).toBe(
      'That item is not a shader example.',
    );
    expect(wrapper.emitted('pick')).toBeUndefined();

    wrapper.unmount();
  });

  it('explains when the picker cannot be loaded', async () => {
    const { wrapper, fake } = mountPicker();
    await openDialog(wrapper);

    fake.lastSession().resolve({
      status: 'rejected',
      reason: 'picker-unavailable',
    });
    await flushPromises();

    expect(
      document.querySelector('.example-picker__error')?.textContent?.trim(),
    ).toBe('The example picker could not be loaded.');

    wrapper.unmount();
  });

  it('closes on Escape and disposes the active session', async () => {
    const { wrapper, fake } = mountPicker();
    await openDialog(wrapper);

    const { dispose } = fake.lastSession();
    const overlay = document.querySelector<HTMLElement>(
      '.example-picker__overlay',
    );
    if (!overlay) throw new Error('modal overlay is not mounted');

    overlay.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await flushPromises();

    expect(dispose).toHaveBeenCalled();
    expect(wrapper.emitted('pick')).toBeUndefined();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    wrapper.unmount();
  });

  it('disposes the active session when the picker unmounts', async () => {
    const { wrapper, fake } = mountPicker();
    await openDialog(wrapper);

    const { dispose } = fake.lastSession();
    wrapper.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('');
  });
});
