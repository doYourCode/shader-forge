// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import ViewerToolbar from './ViewerToolbar.vue';

const mounted: ReturnType<typeof mount>[] = [];

function mountToolbar(wireframe = false, paused = false) {
  const wrapper = mount(ViewerToolbar, {
    props: { wireframe, paused },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
});

describe('ViewerToolbar', () => {
  it('renders only the viewer controls, with no asset selectors', () => {
    const wrapper = mountToolbar();

    expect(wrapper.findAll('fieldset')).toHaveLength(0);
    expect(wrapper.findAll('select')).toHaveLength(0);
    expect(wrapper.text()).toContain('Cfg');
    expect(wrapper.text()).toContain('Pause');
    expect(wrapper.text()).not.toContain('Social');
  });

  it('moves the wireframe toggle into the Cfg menu', async () => {
    const wrapper = mountToolbar(false);

    await wrapper.find('.viewer-toolbar__btn').trigger('click');
    await nextTick();

    const items = wrapper.findAll('[role="menuitemcheckbox"]');

    expect(items).toHaveLength(1);
    expect(items[0]!.text()).toBe('Toggle Wireframe');
    expect(items[0]!.attributes('aria-checked')).toBe('false');
  });

  it('reflects the wireframe state on the menu item', async () => {
    const wrapper = mountToolbar(true);

    await wrapper.find('.viewer-toolbar__btn').trigger('click');
    await nextTick();

    const item = wrapper.find('[role="menuitemcheckbox"]');

    expect(item.attributes('aria-checked')).toBe('true');
    expect(item.text()).toBe('✓Toggle Wireframe');
  });

  it('emits toggle-wireframe and closes the menu', async () => {
    const wrapper = mountToolbar();

    await wrapper.find('.viewer-toolbar__btn').trigger('click');
    await nextTick();
    await wrapper.find('[role="menuitemcheckbox"]').trigger('click');

    expect(wrapper.emitted('toggle-wireframe')).toHaveLength(1);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('reflects the paused state on the pause toggle', () => {
    const wrapper = mountToolbar(false, true);

    expect(wrapper.text()).toContain('Resume');
    expect(wrapper.findAll('.viewer-toolbar__btn--active')).toHaveLength(1);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const wrapper = mountToolbar();

    const trigger = wrapper.find('.viewer-toolbar__btn');
    await trigger.trigger('click');
    await nextTick();

    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Escape' });
    await nextTick();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
  });

  it('closes when a pointer goes down outside the menu', async () => {
    const wrapper = mountToolbar();

    await wrapper.find('.viewer-toolbar__btn').trigger('click');
    await nextTick();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });
});
