// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import { i18n } from '@/i18n';
import type { UserUniformKind, UserUniformValue } from '@/core/models/userUniform';
import UniformValueInput from './UniformValueInput.vue';
import UserColorPicker from './UserColorPicker.vue';

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

  it('lists only repository textures matching the sampler kind', () => {
    const sampler2D = mountInput('sampler2D', { kind: 'url', url: '' });
    expect(
      sampler2D
        .findAll('select.uniform-value__texture-select option')
        .map((option) => option.attributes('value')),
    ).toEqual(['none', 'repository:uv-checker-01', 'custom']);

    const samplerCube = mountInput('samplerCube', { kind: 'url', url: '' });
    expect(
      samplerCube
        .findAll('select.uniform-value__texture-select option')
        .map((option) => option.attributes('value')),
    ).toEqual(['none', 'custom']);
  });

  it('emits a repository source when a catalog texture is selected', async () => {
    const wrapper = mountInput('sampler2D', { kind: 'url', url: '' });

    await wrapper
      .find('select.uniform-value__texture-select')
      .setValue('repository:uv-checker-01');

    expect(wrapper.emitted('change')?.[0]).toEqual([
      { kind: 'repository', textureId: 'uv-checker-01' },
    ]);
  });

  it('emits an empty URL when None is selected', async () => {
    const wrapper = mountInput('sampler2D', {
      kind: 'repository',
      textureId: 'uv-checker-01',
    });

    await wrapper.find('select.uniform-value__texture-select').setValue('none');

    expect(wrapper.emitted('change')?.[0]).toEqual([{ kind: 'url', url: '' }]);
  });

  it('shows the catalog label for a repository texture', () => {
    const wrapper = mountInput('sampler2D', {
      kind: 'repository',
      textureId: 'uv-checker-01',
    });
    const select = wrapper.find('select.uniform-value__texture-select');

    expect((select.element as HTMLSelectElement).value).toBe(
      'repository:uv-checker-01',
    );
    expect(wrapper.find('.uniform-value__texture-name').text()).toBe(
      'UV Checker 01',
    );
    expect(wrapper.find('input.uniform-value__url').exists()).toBe(false);
    expect(wrapper.find('input.uniform-value__file-input').exists()).toBe(
      false,
    );
  });

  it('shows a disabled option when a repository id is not in the catalog', () => {
    const wrapper = mountInput('sampler2D', {
      kind: 'repository',
      textureId: 'removed-texture',
    });
    const select = wrapper.find('select.uniform-value__texture-select');
    const missing = select.find('option[disabled]');

    expect((select.element as HTMLSelectElement).value).toBe('missing');
    expect(missing.exists()).toBe(true);
    expect(missing.text()).toContain('Unavailable');
    expect(missing.text()).toContain('removed-texture');
    expect(wrapper.find('.uniform-value__texture-name').text()).toBe(
      'Unavailable',
    );
  });

  it('reveals the URL field when custom mode is chosen', async () => {
    const wrapper = mountInput('sampler2D', {
      kind: 'repository',
      textureId: 'uv-checker-01',
    });

    expect(wrapper.find('input.uniform-value__url').exists()).toBe(false);

    await wrapper
      .find('select.uniform-value__texture-select')
      .setValue('custom');

    expect(wrapper.find('input.uniform-value__url').exists()).toBe(true);
    expect(wrapper.emitted('change')).toBeUndefined();
  });
});
