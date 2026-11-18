// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import { i18n } from '@/i18n';
import type { PostEffectDocument } from '@/core/models/postEffect';
import PostEffectPanel from './PostEffectPanel.vue';

const EFFECTS: readonly PostEffectDocument[] = [
  { id: 'effect-1', name: 'Edges', enabled: true, fragment: '' },
  { id: 'effect-2', name: 'AO', enabled: false, fragment: '' },
];

function mountPanel(activeId = 'effect-1') {
  return mount(PostEffectPanel, {
    props: {
      effects: EFFECTS,
      activeId,
      tonemap: 'none' as const,
    },
    global: { plugins: [i18n] },
  });
}

describe('PostEffectPanel', () => {
  it('lists the effects in stack order and marks the active one', () => {
    const wrapper = mountPanel();

    const names = wrapper
      .findAll('.post-effects__select')
      .map((button) => button.text());

    expect(names).toEqual(['Edges', 'AO']);
    expect(wrapper.findAll('.post-effects__item')[0]!.classes()).toContain(
      'post-effects__item--active',
    );
    expect(
      wrapper
        .findAll('.post-effects__item')[1]!
        .find('.post-effects__disabled')
        .exists(),
    ).toBe(true);
  });

  it('emits the effect id when the stack entry is selected', async () => {
    const wrapper = mountPanel();

    await wrapper.findAll('.post-effects__select')[1]!.trigger('click');

    expect(wrapper.emitted('select')?.[0]).toEqual(['effect-2']);
  });

  it('emits add when a new effect is requested', async () => {
    const wrapper = mountPanel();

    await wrapper.find('.post-effects__add').trigger('click');

    expect(wrapper.emitted('add')).toHaveLength(1);
  });

  it('emits the enabled state when the checkbox changes', async () => {
    const wrapper = mountPanel();

    await wrapper.findAll('.post-effects__enabled')[1]!.setValue(true);

    expect(wrapper.emitted('toggle')?.[0]).toEqual(['effect-2', true]);
  });

  it('only moves entries that have a neighbour in that direction', async () => {
    const wrapper = mountPanel();
    const actions = wrapper.findAll('.post-effects__item');

    const up = actions[0]!.findAll('.post-effects__action')[0]!;
    const down = actions[1]!.findAll('.post-effects__action')[1]!;

    expect(up.attributes('disabled')).toBeDefined();
    expect(down.attributes('disabled')).toBeDefined();

    await actions[0]!.findAll('.post-effects__action')[1]!.trigger('click');
    expect(wrapper.emitted('move')?.[0]).toEqual(['effect-1', 1]);
  });

  it('emits remove for the chosen entry', async () => {
    const wrapper = mountPanel();

    await wrapper
      .findAll('.post-effects__item')[1]!
      .findAll('.post-effects__action')[2]!
      .trigger('click');

    expect(wrapper.emitted('remove')?.[0]).toEqual(['effect-2']);
  });

  it('emits the selected output transform', async () => {
    const wrapper = mountPanel();

    await wrapper.find('.post-effects__tonemap select').setValue('aces');

    expect(wrapper.emitted('tonemap')?.[0]).toEqual(['aces']);
  });
});
