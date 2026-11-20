// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import SceneAssetMenu from './SceneAssetMenu.vue';

const ITEMS = [
  {
    id: 'monkey',
    label: 'Monkey',
    thumbnailUrl: '/thumbs/monkey.png',
  },
  {
    id: 'sphere',
    label: 'Sphere',
    thumbnailUrl: '/thumbs/sphere.png',
  },
];

function mountMenu(activeId = 'monkey') {
  return mount(SceneAssetMenu, {
    props: { label: 'Model', items: ITEMS, activeId },
    attachTo: document.body,
  });
}

const mounted: ReturnType<typeof mountMenu>[] = [];

function mountAttached(activeId = 'monkey') {
  const wrapper = mountMenu(activeId);
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  while (mounted.length > 0) {
    mounted.pop()?.unmount();
  }
});

describe('SceneAssetMenu', () => {
  it('renders a closed trigger labelled with the category', () => {
    const wrapper = mountAttached();

    const trigger = wrapper.find('.scene-asset-menu__trigger');

    expect(trigger.text()).toBe('Model');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(trigger.attributes('aria-haspopup')).toBe('menu');
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('shows every asset with its name and thumbnail when opened', async () => {
    const wrapper = mountAttached();

    await wrapper.find('.scene-asset-menu__trigger').trigger('click');
    await nextTick();

    const items = wrapper.findAll('[role="menuitemradio"]');

    expect(items.map((item) => item.text())).toEqual(['Monkey✓', 'Sphere']);

    const thumbnails = wrapper.findAll('.scene-asset-menu__thumb');
    expect(thumbnails.map((img) => img.attributes('src'))).toEqual([
      '/thumbs/monkey.png',
      '/thumbs/sphere.png',
    ]);
    expect(thumbnails[0]?.attributes('alt')).toBe('');
  });

  it('marks the active asset as checked', async () => {
    const wrapper = mountAttached('sphere');

    await wrapper.find('.scene-asset-menu__trigger').trigger('click');
    await nextTick();

    const items = wrapper.findAll('[role="menuitemradio"]');

    expect(items.map((item) => item.attributes('aria-checked'))).toEqual([
      'false',
      'true',
    ]);
  });

  it('emits the picked asset and closes the menu', async () => {
    const wrapper = mountAttached();

    await wrapper.find('.scene-asset-menu__trigger').trigger('click');
    await nextTick();

    await wrapper.findAll('[role="menuitemradio"]')[1]!.trigger('click');

    expect(wrapper.emitted('select')?.[0]).toEqual(['sphere']);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const wrapper = mountAttached();

    await wrapper.find('.scene-asset-menu__trigger').trigger('click');
    await nextTick();

    await wrapper.find('[role="menu"]').trigger('keydown', { key: 'Escape' });
    await nextTick();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(document.activeElement).toBe(
      wrapper.find('.scene-asset-menu__trigger').element,
    );
  });

  it('closes when a pointer goes down outside the menu', async () => {
    const wrapper = mountAttached();

    await wrapper.find('.scene-asset-menu__trigger').trigger('click');
    await nextTick();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('moves focus through the items with the arrow keys', async () => {
    const wrapper = mountAttached();

    await wrapper.find('.scene-asset-menu__trigger').trigger('click');
    await nextTick();

    const menu = wrapper.find('[role="menu"]');
    const items = wrapper.findAll('[role="menuitemradio"]');

    // Opening focuses the selected item; the next one follows it.
    expect(document.activeElement).toBe(items[0]!.element);

    await menu.trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]!.element);

    await menu.trigger('keydown', { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]!.element);

    await menu.trigger('keydown', { key: 'End' });
    expect(document.activeElement).toBe(items[1]!.element);

    await menu.trigger('keydown', { key: 'Home' });
    expect(document.activeElement).toBe(items[0]!.element);
  });
});
