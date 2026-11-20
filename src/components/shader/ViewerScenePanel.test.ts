// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { nextTick } from 'vue';

import en from '@/i18n/locales/en.json';
import ptBR from '@/i18n/locales/pt-BR.json';
import ViewerScenePanel from './ViewerScenePanel.vue';
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewModel } from '@/core/models/previewModel';

/** Labels are deliberately not the rendered text: option text must come from i18n. */
const MODELS: readonly PreviewModel[] = [
  {
    id: 'monkey',
    label: 'catalog-monkey',
    url: '/monkey.glb',
    thumbnailUrl: '/thumbs/monkey.png',
  },
  {
    id: 'sphere',
    label: 'catalog-sphere',
    url: '/sphere.glb',
    thumbnailUrl: '/thumbs/sphere.png',
  },
];

const HDRIS: readonly PreviewHdri[] = [
  {
    id: 'wooden-studio-17',
    label: 'catalog-studio',
    url: '/studio.env',
    thumbnailUrl: '/thumbs/wooden_studio_17.png',
    format: 'env',
  },
  {
    id: 'peppermint-powerplant',
    label: 'catalog-peppermint',
    url: '/peppermint.env',
    thumbnailUrl: '/thumbs/peppermint_powerplant.png',
    format: 'env',
  },
];

function mountPanel(
  activeModelId = 'monkey',
  activeHdriId = 'wooden-studio-17',
) {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en, 'pt-BR': ptBR },
  });

  const wrapper = mount(ViewerScenePanel, {
    props: {
      models: MODELS,
      activeModelId,
      hdris: HDRIS,
      activeHdriId,
    },
    global: { plugins: [i18n] },
  });

  return { wrapper, i18n };
}

describe('ViewerScenePanel', () => {
  it('renders one Model and one Environment menu', () => {
    const { wrapper } = mountPanel();

    const triggers = wrapper
      .findAll('.scene-asset-menu__trigger')
      .map((trigger) => trigger.text());

    expect(triggers).toEqual(['Model', 'Environment']);
    expect(wrapper.findAll('.scene-asset-menu__chevron')).toHaveLength(2);
  });

  it('lists the translated models with their thumbnails', async () => {
    const { wrapper } = mountPanel();

    await wrapper.findAll('.scene-asset-menu__trigger')[0]!.trigger('click');
    await nextTick();

    const items = wrapper.findAll('[role="menuitemradio"]');

    expect(items.map((item) => item.text())).toEqual(['Monkey✓', 'Sphere']);
    expect(
      wrapper
        .findAll('.scene-asset-menu__thumb')
        .map((img) => img.attributes('src')),
    ).toEqual(['/thumbs/monkey.png', '/thumbs/sphere.png']);
  });

  it('lists the translated environments with their thumbnails', async () => {
    const { wrapper } = mountPanel();

    await wrapper.findAll('.scene-asset-menu__trigger')[1]!.trigger('click');
    await nextTick();

    expect(
      wrapper.findAll('[role="menuitemradio"]').map((item) => item.text()),
    ).toEqual(['Wooden Studio 17✓', 'Peppermint Powerplant']);
  });

  it('forwards the model and environment picks', async () => {
    const { wrapper } = mountPanel();

    await wrapper.findAll('.scene-asset-menu__trigger')[0]!.trigger('click');
    await nextTick();
    await wrapper.findAll('[role="menuitemradio"]')[1]!.trigger('click');

    expect(wrapper.emitted('select-model')?.[0]).toEqual(['sphere']);

    await wrapper.findAll('.scene-asset-menu__trigger')[1]!.trigger('click');
    await nextTick();
    await wrapper.findAll('[role="menuitemradio"]')[1]!.trigger('click');

    expect(wrapper.emitted('select-hdri')?.[0]).toEqual([
      'peppermint-powerplant',
    ]);
  });

  it('re-translates the list when the locale changes', async () => {
    const { wrapper, i18n } = mountPanel();

    await wrapper.findAll('.scene-asset-menu__trigger')[0]!.trigger('click');
    await nextTick();

    i18n.global.locale.value = 'pt-BR';
    await nextTick();

    expect(
      wrapper.findAll('[role="menuitemradio"]').map((item) => item.text()),
    ).toEqual(['Macaco✓', 'Esfera']);
  });
});
