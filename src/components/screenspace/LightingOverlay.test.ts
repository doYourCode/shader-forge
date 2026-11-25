// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import { i18n } from '@/i18n';
import LightingOverlay from './LightingOverlay.vue';

function mountOverlay(
  props: { sunIntensity?: number; environmentIntensity?: number } = {},
) {
  return mount(LightingOverlay, {
    props: {
      sunIntensity: 2,
      environmentIntensity: 0.6,
      ...props,
    },
    global: { plugins: [i18n] },
  });
}

describe('LightingOverlay', () => {
  it('shows both intensities and their current values', () => {
    const wrapper = mountOverlay({
      sunIntensity: 2.5,
      environmentIntensity: 1,
    });

    expect(wrapper.findAll('.lighting-overlay__range')).toHaveLength(2);
    expect(
      wrapper.find('.lighting-overlay__sun .lighting-overlay__value').text(),
    ).toBe('2.50');
    expect(
      wrapper
        .find('.lighting-overlay__environment .lighting-overlay__value')
        .text(),
    ).toBe('1.00');
  });

  it('emits the sun intensity when the slider moves', async () => {
    const wrapper = mountOverlay();

    await wrapper.find('.lighting-overlay__sun input').setValue('3.75');

    expect(wrapper.emitted('sun-intensity')?.[0]).toEqual([3.75]);
  });

  it('emits the environment intensity when the slider moves', async () => {
    const wrapper = mountOverlay();

    await wrapper.find('.lighting-overlay__environment input').setValue('1.25');

    expect(wrapper.emitted('environment-intensity')?.[0]).toEqual([1.25]);
  });

  it('keeps the slider bounds on the shared policy', () => {
    const wrapper = mountOverlay();
    const sun = wrapper.find('.lighting-overlay__sun input');

    expect(sun.attributes('min')).toBe('0');
    expect(sun.attributes('max')).toBe('5');
  });
});
