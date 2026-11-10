// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import { i18n } from '@/i18n';
import type {
  SamplerKind,
  UserTextureSource,
} from '@/core/models/userUniform';
import type {
  TexturePickerPort,
  TexturePickerSession,
  TexturePickRequest,
  TexturePickResult,
} from '@/services/texturepicker/TexturePicker';

import TextureSourceInput from './TextureSourceInput.vue';
import { TEXTURE_PICKER } from './texturePickerContext';

interface FakeSession {
  readonly session: TexturePickerSession;
  readonly resolve: (result: TexturePickResult) => void;
  readonly dispose: ReturnType<typeof vi.fn>;
}

function createFakePicker() {
  const sessions: FakeSession[] = [];

  const open = vi.fn(
    (
      _request: TexturePickRequest,
      _host: HTMLElement,
    ): TexturePickerSession => {
      let resolve!: (result: TexturePickResult) => void;
      const result = new Promise<TexturePickResult>((resolvePromise) => {
        resolve = resolvePromise;
      });
      const dispose = vi.fn(() => resolve({ status: 'cancelled' }));
      const session: TexturePickerSession = { result, dispose };

      sessions.push({ session, resolve, dispose });
      return session;
    },
  );

  const picker: TexturePickerPort = { open };

  return {
    picker,
    open,
    sessions,
    lastSession: () => {
      const last = sessions.at(-1);
      if (!last) throw new Error('no picker session was opened');
      return last;
    },
  };
}

function mountInput(options: {
  kind?: SamplerKind;
  value?: UserTextureSource;
  label?: string;
} = {}) {
  const fake = createFakePicker();

  const wrapper = mount(TextureSourceInput, {
    props: {
      kind: options.kind ?? 'sampler2D',
      value: options.value ?? { kind: 'url', url: '' },
      label: options.label,
    },
    global: {
      plugins: [i18n],
      provide: { [TEXTURE_PICKER]: fake.picker },
    },
    attachTo: document.body,
  });

  return { wrapper, fake };
}

async function openPicker(wrapper: ReturnType<typeof mountInput>['wrapper']) {
  await wrapper.find('.texture-source__choose').trigger('click');
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

describe('TextureSourceInput', () => {
  it('renders the current value label for each source kind', () => {
    const repository = mountInput({
      value: { kind: 'repository', textureId: 'uv-checker-01' },
    });
    expect(repository.wrapper.find('.texture-source__value').text()).toBe(
      'UV Checker 01',
    );
    expect(repository.wrapper.find('.texture-source__preview').exists()).toBe(
      true,
    );
    repository.wrapper.unmount();

    const file = new File(['pixels'], 'albedo.png', { type: 'image/png' });
    const uploaded = mountInput({ value: { kind: 'file', file } });
    expect(uploaded.wrapper.find('.texture-source__value').text()).toBe(
      'albedo.png',
    );
    expect(uploaded.wrapper.find('.texture-source__preview').exists()).toBe(
      false,
    );
    uploaded.wrapper.unmount();

    const url = mountInput({
      value: { kind: 'url', url: 'https://example.test/albedo.png' },
    });
    expect(url.wrapper.find('.texture-source__value').text()).toBe(
      'https://example.test/albedo.png',
    );
    url.wrapper.unmount();

    const empty = mountInput({ value: { kind: 'url', url: '' } });
    expect(empty.wrapper.find('.texture-source__value').text()).toBe(
      'No texture selected',
    );
    expect(empty.wrapper.find('.texture-source__choose').text()).toBe(
      'Choose texture…',
    );
    empty.wrapper.unmount();
  });

  it('shows Unavailable with the missing id in the title', () => {
    const { wrapper } = mountInput({
      value: { kind: 'repository', textureId: 'removed-texture' },
    });

    const value = wrapper.find('.texture-source__value');
    expect(value.text()).toBe('Unavailable');
    expect(value.attributes('title')).toBe('removed-texture');
    expect(wrapper.find('.texture-source__preview').exists()).toBe(false);

    wrapper.unmount();
  });

  it('opens the picker with the sampler kind and the modal host', async () => {
    const { wrapper, fake } = mountInput();

    await openPicker(wrapper);

    expect(fake.open).toHaveBeenCalledTimes(1);
    const [request, host] = fake.open.mock.calls[0]!;
    expect(request).toEqual({ sampler: 'sampler2D' });
    expect(host).toBeInstanceOf(HTMLElement);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(true);

    wrapper.unmount();

    expect(document.body.style.overflow).toBe('');
    expect(document.getElementById('app')?.hasAttribute('inert')).toBe(false);
  });

  it('emits the picked repository source', async () => {
    const { wrapper, fake } = mountInput();
    await openPicker(wrapper);

    fake.lastSession().resolve({
      status: 'picked',
      source: { kind: 'repository', textureId: 'uv-checker-01' },
    });
    await flushPromises();

    expect(wrapper.emitted('change')?.[0]).toEqual([
      { kind: 'repository', textureId: 'uv-checker-01' },
    ]);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    wrapper.unmount();
  });

  it('emits nothing when the picker is cancelled', async () => {
    const { wrapper, fake } = mountInput();
    await openPicker(wrapper);

    fake.lastSession().resolve({ status: 'cancelled' });
    await flushPromises();

    expect(wrapper.emitted('change')).toBeUndefined();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    wrapper.unmount();
  });

  it('shows an alert when the picked asset is rejected', async () => {
    const { wrapper, fake } = mountInput();
    await openPicker(wrapper);

    fake.lastSession().resolve({
      status: 'rejected',
      reason: 'unsupported-asset',
    });
    await flushPromises();

    const alert = wrapper.find('.texture-source__error');
    expect(alert.attributes('role')).toBe('alert');
    expect(alert.text()).toBe('That asset cannot be used as a texture.');
    expect(wrapper.emitted('change')).toBeUndefined();

    wrapper.unmount();
  });

  it('shows an alert when the picker cannot be loaded', async () => {
    const { wrapper, fake } = mountInput();
    await openPicker(wrapper);

    fake.lastSession().resolve({
      status: 'rejected',
      reason: 'picker-unavailable',
    });
    await flushPromises();

    expect(wrapper.find('.texture-source__error').text()).toBe(
      'The texture picker could not be loaded.',
    );

    wrapper.unmount();
  });

  it('clears the texture with an empty URL source', async () => {
    const { wrapper } = mountInput({
      value: { kind: 'repository', textureId: 'uv-checker-01' },
    });

    await wrapper.find('.texture-source__clear').trigger('click');

    expect(wrapper.emitted('change')?.[0]).toEqual([{ kind: 'url', url: '' }]);

    wrapper.unmount();
  });

  it('keeps the advanced URL and file inputs functional', async () => {
    const { wrapper } = mountInput();

    await wrapper.find('.texture-source__url').setValue('/albedo.png');
    expect(wrapper.emitted('change')?.[0]).toEqual([
      { kind: 'url', url: '/albedo.png' },
    ]);

    const file = new File(['pixels'], 'albedo.png', { type: 'image/png' });
    const input = wrapper.find('.texture-source__file-input');
    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    });
    await input.trigger('change');

    expect(wrapper.emitted('change')?.[1]).toEqual([{ kind: 'file', file }]);

    wrapper.unmount();
  });

  it('disables the bundled picker and hints for a sampler without textures', () => {
    const { wrapper } = mountInput({ kind: 'samplerCube' });

    expect(
      wrapper.find('.texture-source__choose').attributes('disabled'),
    ).toBeDefined();
    expect(wrapper.find('.texture-source__hint').text()).toContain(
      'No bundled textures are available for this sampler',
    );
    expect(wrapper.find('.texture-source__url').exists()).toBe(true);
    expect(wrapper.find('.texture-source__file-input').exists()).toBe(true);

    wrapper.unmount();
  });

  it('closes on Escape and disposes the active session', async () => {
    const { wrapper, fake } = mountInput();
    await openPicker(wrapper);

    const { dispose } = fake.lastSession();
    const overlay = document.querySelector<HTMLElement>(
      '.texture-source__overlay',
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
    expect(wrapper.emitted('change')).toBeUndefined();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    wrapper.unmount();
  });

  it('disposes the active session when the widget unmounts', async () => {
    const { wrapper, fake } = mountInput();
    await openPicker(wrapper);

    const { dispose } = fake.lastSession();
    wrapper.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('');
  });
});
