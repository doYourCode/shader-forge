// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import EditorToolbar from './EditorToolbar.vue';
import {
  builtInTabGroup,
  editableTabs,
  type EditorTabId,
} from '@/core/models/editorTab';

function mountToolbar(active: EditorTabId = 'vertex') {
  return mount(EditorToolbar, {
    props: {
      tabs: editableTabs,
      builtIn: builtInTabGroup,
      active,
    },
  });
}

describe('EditorToolbar', () => {
  it('renders the editable tabs and one collapsed built-in tab', () => {
    const wrapper = mountToolbar();

    const tabLabels = wrapper
      .findAll('.editor-toolbar__tab')
      .map((tab) => tab.text());

    expect(tabLabels).toEqual(['Vertex', 'Fragment', 'Uniforms']);
    expect(wrapper.find('.editor-toolbar__builtin-label').text()).toBe(
      'Built-in',
    );
  });

  it('opens the built-in menu and switches the active document', async () => {
    const wrapper = mountToolbar();

    await wrapper.find('.editor-toolbar__tab--builtin').trigger('click');
    await nextTick();

    expect(wrapper.emitted('switch')?.[0]).toEqual(['uniforms']);

    const items = wrapper.findAll('[role="menuitemradio"]');
    expect(items).toHaveLength(2);

    await items[1]!.trigger('click');

    expect(wrapper.emitted('switch')?.[1]).toEqual(['io']);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('shows the active built-in document on the trigger', () => {
    const wrapper = mountToolbar('io');

    expect(wrapper.find('.editor-toolbar__tab--builtin').text()).toContain(
      'Attributes',
    );
  });
});
