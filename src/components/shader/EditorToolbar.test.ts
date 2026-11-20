// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { i18n } from '@/i18n';
import EditorToolbar from './EditorToolbar.vue';
import { EXAMPLE_PICKER } from './examplePickerContext';
import {
  dataTabGroup,
  postTab,
  stageTabGroup,
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
      groups: [stageTabGroup, dataTabGroup],
      tabs: [postTab],
      active,
    },
    global: {
      plugins: [i18n],
      provide: { [EXAMPLE_PICKER]: picker },
    },
  });
}

function groupTrigger(wrapper: ReturnType<typeof mountToolbar>, label: string) {
  const match = wrapper
    .findAll('.tab-group__trigger')
    .find((trigger) => trigger.text().includes(label));

  if (!match) throw new Error(`group ${label} not found`);
  return match;
}

async function openGroup(
  wrapper: ReturnType<typeof mountToolbar>,
  label: string,
): Promise<void> {
  await groupTrigger(wrapper, label).trigger('click');
  await nextTick();
}

describe('EditorToolbar', () => {
  it('renders the two document groups before the standalone tab', () => {
    const wrapper = mountToolbar();

    const triggers = wrapper
      .findAll('.tab-group__trigger')
      .map((trigger) => trigger.text());

    expect(triggers[0]).toContain('Shader Stages');
    expect(triggers[1]).toContain('Shader Data');
    expect(
      wrapper.findAll('.editor-toolbar__tab').map((tab) => tab.text()),
    ).toEqual(['Post effect']);
  });

  it('puts Vertex and Fragment behind the Shader Stages menu', async () => {
    const wrapper = mountToolbar();

    await openGroup(wrapper, 'Shader Stages');

    const items = wrapper.findAll('[role="menuitemradio"]');

    expect(items.map((item) => item.text())).toEqual(['✓Vertex', 'Fragment']);

    await items[1]!.trigger('click');

    expect(wrapper.emitted('switch')?.[0]).toEqual(['fragment']);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('puts user data, attributes and uniforms behind the Shader Data menu', async () => {
    const wrapper = mountToolbar();

    await openGroup(wrapper, 'Shader Data');

    const items = wrapper.findAll('[role="menuitemradio"]');

    expect(items.map((item) => item.text())).toEqual([
      'User data',
      'Attributes',
      'Uniforms',
    ]);

    await items[1]!.trigger('click');

    expect(wrapper.emitted('switch')?.[0]).toEqual(['io']);
  });

  it('shows the open document on the group that holds it', () => {
    const wrapper = mountToolbar('io');

    expect(groupTrigger(wrapper, 'Shader Data').text()).toContain('Attributes');
    expect(groupTrigger(wrapper, 'Shader Stages').text()).toBe('Shader Stages');
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
