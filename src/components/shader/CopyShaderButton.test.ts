// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

import en from '@/i18n/locales/en.json';
import CopyShaderButton from './CopyShaderButton.vue';

const PAYLOAD = [
  '#version 300 es',
  '// >>> ShaderForge user data (managed block — edit it in the User data tab)',
  'uniform vec3 tint; // color (RGB)',
  '// current values: tint = (0.72, 0.31, 0.22)',
  '// <<< end ShaderForge user data >>>',
  'void main() {}',
].join('\n');

function mountButton(getText: () => string = () => PAYLOAD) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en },
  });

  return mount(CopyShaderButton, {
    props: { getText },
    global: { plugins: [i18n] },
  });
}

function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

function stubLegacyCopy(result: boolean): void {
  Object.defineProperty(document, 'execCommand', {
    value: vi.fn(() => result),
    configurable: true,
  });
}

describe('CopyShaderButton', () => {
  beforeEach(() => {
    // Only the reset timer is faked: flushPromises relies on setImmediate.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('copies the resolved source and confirms it, then returns to idle', async () => {
    const writeText = vi.fn(async () => {});
    const getText = vi.fn(() => PAYLOAD);
    stubClipboard(writeText);

    const wrapper = mountButton(getText);
    await wrapper.find('.copy-shader__button').trigger('click');
    await flushPromises();

    // Resolved on click, not at mount, so live edits reach the clipboard.
    expect(getText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(PAYLOAD);
    expect(wrapper.find('.copy-shader__tooltip').text()).toBe('Copied');

    await vi.advanceTimersByTimeAsync(1600);

    expect(wrapper.find('.copy-shader__tooltip').text()).toBe(
      'Copy source with generated user data',
    );

    wrapper.unmount();
  });

  it('reports a refused copy instead of failing silently', async () => {
    stubClipboard(async () => {
      throw new Error('denied');
    });
    stubLegacyCopy(false);

    const wrapper = mountButton();
    await wrapper.find('.copy-shader__button').trigger('click');
    await flushPromises();

    expect(wrapper.find('.copy-shader__tooltip').text()).toBe('Copy failed');
    expect(wrapper.find('.copy-shader__button--failed').exists()).toBe(true);

    wrapper.unmount();
  });

  it('falls back to the legacy copy path when the clipboard is unavailable', async () => {
    // Plain http previews have no navigator.clipboard at all.
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    stubLegacyCopy(true);

    const wrapper = mountButton();
    await wrapper.find('.copy-shader__button').trigger('click');
    await flushPromises();

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(wrapper.find('.copy-shader__tooltip').text()).toBe('Copied');

    wrapper.unmount();
  });

  it('exposes a label and a described tooltip for assistive tech', () => {
    const wrapper = mountButton();
    const button = wrapper.find('.copy-shader__button');
    const tooltip = wrapper.find('.copy-shader__tooltip');

    expect(button.attributes('aria-label')).toBe('Copy shader source');
    expect(tooltip.attributes('role')).toBe('tooltip');
    expect(button.attributes('aria-describedby')).toBe(
      tooltip.attributes('id'),
    );
    expect(tooltip.attributes('aria-live')).toBe('polite');

    wrapper.unmount();
  });
});
