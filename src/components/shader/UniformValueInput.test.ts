// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import { i18n } from '@/i18n';
import type { UserUniformKind, UserUniformValue } from '@/core/models/userUniform';
import type { TexturePickerPort } from '@/services/texturepicker/TexturePicker';
import TextureSourceInput from './TextureSourceInput.vue';
import UniformValueInput from './UniformValueInput.vue';
import UserColorPicker from './UserColorPicker.vue';
import { TEXTURE_PICKER } from './texturePickerContext';

/** The texture widget is only delegated to; opening is covered elsewhere. */
function createFakeTexturePicker(): TexturePickerPort {
  return {
    open: () => ({
      result: Promise.resolve({ status: 'cancelled' }),
      dispose: () => undefined,
    }),
  };
}

function mountInput(
  kind: UserUniformKind,
  value: UserUniformValue,
  label?: string,
) {
  return mount(UniformValueInput, {
    props: { kind, value, label },
    global: {
      plugins: [i18n],
      provide: { [TEXTURE_PICKER]: createFakeTexturePicker() },
    },
  });
}

describe('UniformValueInput', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  afterEach(() => {
    // Teleported color panels live in body, outside the wrapper.
    document.body.innerHTML = '';
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

    wrapper.findComponent(UserColorPicker).vm.$emit('change', {
      r: 1,
      g: 0,
      b: 0,
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('change')?.[0]).toEqual([{ r: 1, g: 0, b: 0 }]);
  });

  it('keeps the alpha channel when an RGBA colour changes', async () => {
    const wrapper = mountInput('color4', { r: 0, g: 0, b: 0, a: 0.5 });

    const picker = wrapper.findComponent(UserColorPicker);
    expect(picker.props('alpha')).toBe(0.5);

    picker.vm.$emit('change', { r: 0, g: 1, b: 0, a: 0.5 });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('change')?.[0]).toEqual([
      { r: 0, g: 1, b: 0, a: 0.5 },
    ]);
  });

  it('forwards the uniform name to the colour picker', () => {
    const wrapper = mount(UniformValueInput, {
      props: {
        kind: 'color',
        value: { r: 1, g: 1, b: 1 },
        label: 'tint',
      },
      global: { plugins: [i18n] },
    });

    expect(wrapper.findComponent(UserColorPicker).props('label')).toBe('tint');
  });

  it('edits the alpha channel without touching the colour', async () => {
    const wrapper = mountInput('color4', { r: 0.2, g: 0.4, b: 0.6, a: 1 });

    await wrapper.find('input.uniform-value__alpha-input').setValue('0.25');

    expect(wrapper.emitted('change')?.[0]).toEqual([
      { r: 0.2, g: 0.4, b: 0.6, a: 0.25 },
    ]);
  });

  it('delegates texture values to TextureSourceInput and forwards changes', async () => {
    const wrapper = mountInput(
      'sampler2D',
      { kind: 'repository', textureId: 'uv-checker-01' },
      'albedo',
    );

    const textureInput = wrapper.findComponent(TextureSourceInput);
    expect(textureInput.exists()).toBe(true);
    expect(textureInput.props('kind')).toBe('sampler2D');
    expect(textureInput.props('value')).toEqual({
      kind: 'repository',
      textureId: 'uv-checker-01',
    });
    expect(textureInput.props('label')).toBe('albedo');

    textureInput.vm.$emit('change', { kind: 'url', url: '/albedo.png' });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('change')?.[0]).toEqual([
      { kind: 'url', url: '/albedo.png' },
    ]);
  });
});
