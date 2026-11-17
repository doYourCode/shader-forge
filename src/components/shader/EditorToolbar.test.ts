// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { i18n } from '@/i18n';
import EditorToolbar from './EditorToolbar.vue';
import { EXAMPLE_PICKER } from './examplePickerContext';
import {
  builtInTabGroup,
  editableTabs,
  type EditorTabId,
} from '@/core/models/editorTab';
import type {
  ExamplePickerPort,
  ExamplePickerSession,
  ExamplePickResult,
} from '@/services/examplepicker/ExamplePicker';

const PICKED_PHONG: ExamplePickResult = {
  status: 'picked',
  exampleId: 'blinn-phong',
};

function createFakePicker(result: ExamplePickResult = PICKED_PHONG) {
  const open = vi.fn((_host: HTMLElement): ExamplePickerSession => ({
    result: Promise.resolve(result),
    ready: Promise.resolve(),
    dispose: vi.fn(),
  }));

  const port: ExamplePickerPort = { preload: vi.fn(), open };

  return { port, open };
}

function mountToolbar(
  active: EditorTabId = 'vertex',
  picker: ExamplePickerPort = createFakePicker().port,
) {
  return mount(EditorToolbar, {
    props: {
      tabs: editableTabs,
      builtIn: builtInTabGroup,
      active,
    },
    global: {
      plugins: [i18n],
      provide: { [EXAMPLE_PICKER]: picker },
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

  it('places the example picker immediately before Compile', () => {
    const wrapper = mountToolbar();

    const picker = wrapper.find('.example-picker__trigger').element;
    const compile = wrapper.find('.editor-toolbar__compile').element;

    const following =
      picker.compareDocumentPosition(compile) &
      Node.DOCUMENT_POSITION_FOLLOWING;

    expect(following).toBeTruthy();
  });

  it('forwards the picked example to the editor', async () => {
    const fake = createFakePicker();
    const wrapper = mountToolbar('vertex', fake.port);

    await wrapper.find('.example-picker__trigger').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('load-example')?.[0]).toEqual(['blinn-phong']);
  });
});
