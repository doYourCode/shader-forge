// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import { i18n } from '@/i18n';
import type { UserUniformKind, UserUniformValue } from '@/core/models/userUniform';
import UniformValueInput from './UniformValueInput.vue';

function mountInput(kind: UserUniformKind, value: UserUniformValue) {
  return mount(UniformValueInput, {
    props: { kind, value },
    global: { plugins: [i18n] },
  });
}

describe('UniformValueInput', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  it('edits a float through a number input', async () => {
    const wrapper = mountInput('float', 0);

    const input = wrapper.find('input.uniform-value__number');
    expect(input.exists()).toBe(true);

    await input.setValue('2.5');

    expect(wrapper.emitted('change')?.[0]).toEqual([2.5]);
  });

  it('ignores an empty or non-numeric float', async () => {
    const wrapper = mountInput('float', 0);

    await wrapper.find('input.uniform-value__number').setValue('');

    expect(wrapper.emitted('change')).toBeUndefined();
  });

  it('edits each vector component independently', async () => {
    const wrapper = mountInput('vec3', { x: 1, y: 2, z: 3 });

    const inputs = wrapper.findAll('input.uniform-value__component-input');
    expect(inputs).toHaveLength(3);

    await inputs[1]!.setValue('8');

    expect(wrapper.emitted('change')?.[0]).toEqual([{ x: 1, y: 8, z: 3 }]);
  });

  it('renders four components for vec4', () => {
    const wrapper = mountInput('vec4', { x: 0, y: 0, z: 0, w: 0 });

    expect(wrapper.findAll('input.uniform-value__component-input')).toHaveLength(
      4,
    );
    expect(
      wrapper.findAll('.uniform-value__component-label').map((label) => label.text()),
    ).toEqual(['x', 'y', 'z', 'w']);
  });

  it('edits an RGB colour through the colour picker', async () => {
    const wrapper = mountInput('color', { r: 1, g: 1, b: 1 });

    await wrapper.find('input.uniform-value__color-input').setValue('#ff0000');

    expect(wrapper.emitted('change')?.[0]).toEqual([{ r: 1, g: 0, b: 0 }]);
  });

  it('keeps the alpha channel when an RGBA colour changes', async () => {
    const wrapper = mountInput('color4', { r: 0, g: 0, b: 0, a: 0.5 });

    await wrapper
      .find('input.uniform-value__color-input')
      .setValue('#00ff00');

    expect(wrapper.emitted('change')?.[0]).toEqual([{ r: 0, g: 1, b: 0, a: 0.5 }]);
  });

  it('edits the alpha channel without touching the colour', async () => {
    const wrapper = mountInput('color4', { r: 0.2, g: 0.4, b: 0.6, a: 1 });

    await wrapper.find('input.uniform-value__alpha-input').setValue('0.25');

    expect(wrapper.emitted('change')?.[0]).toEqual([
      { r: 0.2, g: 0.4, b: 0.6, a: 0.25 },
    ]);
  });

  it('emits a URL texture source while typing', async () => {
    const wrapper = mountInput('sampler2D', { kind: 'url', url: '' });

    await wrapper.find('input.uniform-value__url').setValue('/albedo.png');

    expect(wrapper.emitted('change')?.[0]).toEqual([
      { kind: 'url', url: '/albedo.png' },
    ]);
  });

  it('emits an uploaded file as a texture source', async () => {
    const wrapper = mountInput('sampler2D', { kind: 'url', url: '' });
    const file = new File(['pixels'], 'albedo.png', { type: 'image/png' });
    const input = wrapper.find('input.uniform-value__file-input');

    Object.defineProperty(input.element, 'files', {
      value: [file],
      configurable: true,
    });
    await input.trigger('change');

    expect(wrapper.emitted('change')?.[0]).toEqual([{ kind: 'file', file }]);
  });

  it('shows the uploaded file name as the current texture', () => {
    const file = new File(['pixels'], 'albedo.png');
    const wrapper = mountInput('sampler2D', { kind: 'file', file });

    expect(wrapper.find('.uniform-value__texture-name').text()).toBe(
      'albedo.png',
    );
  });
});
