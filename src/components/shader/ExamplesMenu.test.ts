// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import ExamplesMenu from './ExamplesMenu.vue';
import { shaderExamples } from '@/core/constants/shaderExamples';

function mountMenu() {
  return mount(ExamplesMenu, {
    props: { examples: shaderExamples },
    attachTo: document.body,
  });
}

describe('ExamplesMenu', () => {
  it('keeps the menu closed until the trigger is used', () => {
    const wrapper = mountMenu();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(
      wrapper.find('.examples-menu__trigger').attributes('aria-expanded'),
    ).toBe('false');

    wrapper.unmount();
  });

  it('lists every example, grouped by section', async () => {
    const wrapper = mountMenu();

    await wrapper.find('.examples-menu__trigger').trigger('click');

    expect(
      wrapper
        .findAll('[role="menuitem"]')
        .map((item) => item.attributes('data-example-id')),
    ).toEqual(shaderExamples.map((example) => example.id));

    expect(
      wrapper
        .findAll('.examples-menu__section')
        .map((section) => section.text()),
    ).toEqual(['Lighting', 'Image-based lighting']);

    wrapper.unmount();
  });

  it('emits the picked example and closes the menu', async () => {
    const wrapper = mountMenu();

    await wrapper.find('.examples-menu__trigger').trigger('click');
    await wrapper.find('[data-example-id="cook-torrance"]').trigger('click');

    expect(wrapper.emitted('load')?.[0]).toEqual(['cook-torrance']);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('opens from the keyboard and moves focus through the items', async () => {
    const wrapper = mountMenu();
    const trigger = wrapper.find('.examples-menu__trigger');

    await trigger.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();

    expect(document.activeElement?.getAttribute('data-example-id')).toBe(
      'lambert',
    );

    await wrapper
      .find('[role="menu"]')
      .trigger('keydown', { key: 'ArrowDown' });

    expect(document.activeElement?.getAttribute('data-example-id')).toBe(
      'phong',
    );

    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'End' });

    expect(document.activeElement?.getAttribute('data-example-id')).toBe(
      shaderExamples[shaderExamples.length - 1]!.id,
    );

    wrapper.unmount();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const wrapper = mountMenu();
    const trigger = wrapper.find('.examples-menu__trigger');

    await trigger.trigger('click');
    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Escape' });

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);

    wrapper.unmount();
  });

  it('closes when the pointer goes down outside the menu', async () => {
    const wrapper = mountMenu();

    await wrapper.find('.examples-menu__trigger').trigger('click');
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);

    wrapper.unmount();
  });
});
