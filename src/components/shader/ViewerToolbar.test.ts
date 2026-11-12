// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import ViewerToolbar from './ViewerToolbar.vue';
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewModel } from '@/core/models/previewModel';

const MODELS: readonly PreviewModel[] = [
  { id: 'monkey', label: 'Monkey', url: '/monkey.glb' },
  { id: 'sphere', label: 'Sphere', url: '/sphere.glb' },
  { id: 'cube', label: 'Cube', url: '/cube.glb' },
];

const HDRIS: readonly PreviewHdri[] = [
  { id: 'studio', label: 'Wooden Studio 17', url: '/studio.env', format: 'env' },
  {
    id: 'peppermint',
    label: 'Peppermint Powerplant',
    url: '/peppermint.env',
    format: 'env',
  },
];

function mountToolbar(activeModelId = 'monkey', activeHdriId = 'studio') {
  return mount(ViewerToolbar, {
    props: {
      models: MODELS,
      activeModelId,
      hdris: HDRIS,
      activeHdriId,
      wireframe: false,
      paused: false,
    },
  });
}

describe('ViewerToolbar', () => {
  it('renders the models in a dropdown inside the Models fieldset', () => {
    const wrapper = mountToolbar();
    const fieldset = wrapper.find('fieldset.viewer-toolbar__models');
    const select = fieldset.find('select.viewer-toolbar__model-select');

    expect(fieldset.exists()).toBe(true);
    expect(fieldset.find('legend').text()).toBe('Models');
    expect(select.exists()).toBe(true);
    expect(fieldset.findAll('button')).toHaveLength(0);
    expect(
      select.findAll('option').map((option) => option.text()),
    ).toEqual(['Monkey', 'Sphere', 'Cube']);
    expect((select.element as HTMLSelectElement).value).toBe('monkey');
  });

  it('emits the selected model id when the dropdown changes', async () => {
    const wrapper = mountToolbar('sphere');
    const select = wrapper.find('select.viewer-toolbar__model-select');

    expect((select.element as HTMLSelectElement).value).toBe('sphere');

    await select.setValue('cube');

    expect(wrapper.emitted('select-model')?.[0]).toEqual(['cube']);
  });

  it('renders the HDRIs in a dropdown inside the HDRI fieldset', () => {
    const wrapper = mountToolbar();
    const fieldset = wrapper.find('fieldset.viewer-toolbar__hdri');
    const select = fieldset.find('select.viewer-toolbar__hdri-select');

    expect(fieldset.exists()).toBe(true);
    expect(fieldset.find('legend').text()).toBe('HDRI');
    expect(select.exists()).toBe(true);
    expect(fieldset.findAll('button')).toHaveLength(0);
    expect(
      select.findAll('option').map((option) => option.text()),
    ).toEqual(['Wooden Studio 17', 'Peppermint Powerplant']);
    expect((select.element as HTMLSelectElement).value).toBe('studio');
  });

  it('emits the selected HDRI id when the dropdown changes', async () => {
    const wrapper = mountToolbar('monkey', 'studio');
    const select = wrapper.find('select.viewer-toolbar__hdri-select');

    expect((select.element as HTMLSelectElement).value).toBe('studio');

    await select.setValue('peppermint');

    expect(wrapper.emitted('select-hdri')?.[0]).toEqual(['peppermint']);
  });
});
