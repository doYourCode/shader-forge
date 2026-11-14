// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

import en from '@/i18n/locales/en.json';
import ViewerToolbar from './ViewerToolbar.vue';
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewModel } from '@/core/models/previewModel';

/**
 * Labels are deliberately not the rendered text: option text must come from
 * the fresh English i18n instance, not from the catalog's English label.
 */
const MODELS: readonly PreviewModel[] = [
  { id: 'monkey', label: 'catalog-monkey', url: '/monkey.glb' },
  { id: 'sphere', label: 'catalog-sphere', url: '/sphere.glb' },
  { id: 'cube', label: 'catalog-cube', url: '/cube.glb' },
];

const HDRIS: readonly PreviewHdri[] = [
  {
    id: 'wooden-studio-17',
    label: 'catalog-studio',
    url: '/studio.env',
    format: 'env',
  },
  {
    id: 'peppermint-powerplant',
    label: 'catalog-peppermint',
    url: '/peppermint.env',
    format: 'env',
  },
];

function mountToolbar(
  activeModelId = 'monkey',
  activeHdriId = 'wooden-studio-17',
) {
  // The app singleton boots in pt-BR; this test pins a fresh English instance.
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en },
  });

  return mount(ViewerToolbar, {
    props: {
      models: MODELS,
      activeModelId,
      hdris: HDRIS,
      activeHdriId,
      wireframe: false,
      paused: false,
    },
    global: { plugins: [i18n] },
  });
}

describe('ViewerToolbar', () => {
  it('renders translated models in a dropdown inside the Models fieldset', () => {
    const wrapper = mountToolbar();
    const fieldset = wrapper.find('fieldset.viewer-toolbar__models');
    const select = fieldset.find('select.viewer-toolbar__model-select');

    expect(fieldset.exists()).toBe(true);
    expect(fieldset.find('legend').text()).toBe('Models');
    expect(select.exists()).toBe(true);
    expect(fieldset.findAll('button')).toHaveLength(0);
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      'Monkey',
      'Sphere',
      'Cube',
    ]);
    expect((select.element as HTMLSelectElement).value).toBe('monkey');
  });

  it('emits the selected model id when the dropdown changes', async () => {
    const wrapper = mountToolbar('sphere');
    const select = wrapper.find('select.viewer-toolbar__model-select');

    expect((select.element as HTMLSelectElement).value).toBe('sphere');

    await select.setValue('cube');

    expect(wrapper.emitted('select-model')?.[0]).toEqual(['cube']);
  });

  it('renders translated HDRIs in a dropdown inside the HDRI fieldset', () => {
    const wrapper = mountToolbar();
    const fieldset = wrapper.find('fieldset.viewer-toolbar__hdri');
    const select = fieldset.find('select.viewer-toolbar__hdri-select');

    expect(fieldset.exists()).toBe(true);
    expect(fieldset.find('legend').text()).toBe('HDRI');
    expect(select.exists()).toBe(true);
    expect(fieldset.findAll('button')).toHaveLength(0);
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      'Wooden Studio 17',
      'Peppermint Powerplant',
    ]);
    expect((select.element as HTMLSelectElement).value).toBe(
      'wooden-studio-17',
    );
  });

  it('emits the selected HDRI id when the dropdown changes', async () => {
    const wrapper = mountToolbar();
    const select = wrapper.find('select.viewer-toolbar__hdri-select');

    expect((select.element as HTMLSelectElement).value).toBe(
      'wooden-studio-17',
    );

    await select.setValue('peppermint-powerplant');

    expect(wrapper.emitted('select-hdri')?.[0]).toEqual([
      'peppermint-powerplant',
    ]);
  });

  it('leaves the legends and buttons untranslated', () => {
    const wrapper = mountToolbar();

    expect(wrapper.text()).toContain('Models');
    expect(wrapper.text()).toContain('HDRI');
    expect(wrapper.text()).toContain('Wireframe');
    expect(wrapper.text()).toContain('Pause');
  });
});
