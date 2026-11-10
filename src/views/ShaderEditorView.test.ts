// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { i18n } from '@/i18n';
import UserColorPicker from '@/components/shader/UserColorPicker.vue';
import ShaderEditorView from './ShaderEditorView.vue';

interface BlueprintLike {
  readonly vertex: string;
  readonly fragment: string;
  readonly extraUniforms: readonly string[];
  readonly extraSamplers: readonly string[];
}

const { sceneManager, editorManager } = vi.hoisted(() => {
  const sceneManager = {
    onError: null as ((errors: unknown[]) => void) | null,
    init: vi.fn(),
    compile: vi.fn(async (_blueprint: BlueprintLike) => ({
      ok: true,
      message: 'Compiled successfully',
      errors: [],
    })),
    loadModel: vi.fn(async () => true),
    loadEnvironment: vi.fn(async () => true),
    resize: vi.fn(),
    setWireframe: vi.fn(),
    setPaused: vi.fn(),
    dispose: vi.fn(),
  };
  const editorManager = {
    mount: vi.fn(),
    getValue: vi.fn(() => ''),
    setValue: vi.fn(),
    setReadOnly: vi.fn(),
    setDiagnostics: vi.fn(),
    revealPosition: vi.fn(),
    focus: vi.fn(),
    dispose: vi.fn(),
  };

  return { sceneManager, editorManager };
});

vi.mock('@/services/babylon/SceneManager', () => ({
  SceneManager: class {
    constructor() {
      return sceneManager;
    }
  },
}));

vi.mock('@/services/codemirror/EditorManager', () => ({
  EditorManager: class {
    constructor() {
      return editorManager;
    }
  },
}));

async function mountView() {
  const wrapper = mount(ShaderEditorView, {
    global: { plugins: [i18n] },
  });
  await flushPromises();
  return wrapper;
}

function tab(wrapper: ReturnType<typeof mount>, label: string) {
  const match = wrapper
    .findAll('.editor-toolbar__tab')
    .find((button) => button.text() === label);
  if (!match) throw new Error(`tab ${label} not found`);
  return match;
}

describe('ShaderEditorView user data panel', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
    sceneManager.compile.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Teleported color panels live in body, outside the wrapper.
    document.body.innerHTML = '';
  });

  it('renders the user-data table when the tab is active', async () => {
    const wrapper = await mountView();

    expect(wrapper.find('.user-data').exists()).toBe(false);
    expect(
      (wrapper.find('.shader-editor__editor-host').element as HTMLElement).style
        .display,
    ).not.toBe('none');

    await tab(wrapper, 'User data').trigger('click');

    expect(wrapper.find('.user-data').exists()).toBe(true);
    expect(
      (wrapper.find('.shader-editor__editor-host').element as HTMLElement).style
        .display,
    ).toBe('none');
    expect(wrapper.find('.user-data__empty').exists()).toBe(true);

    wrapper.unmount();
  });

  it('adds a uniform and recompiles with the generated declaration', async () => {
    const wrapper = await mountView();
    await tab(wrapper, 'User data').trigger('click');

    await wrapper.find('.user-data__new-name').setValue('tint');
    await wrapper.find('.user-data__new-kind').setValue('color');
    await wrapper.find('.user-data__add').trigger('submit');
    await nextTick();

    const rows = wrapper.findAll('.user-data__row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.find('.user-data__name').element).toHaveProperty(
      'value',
      'tint',
    );

    // Structural edits are debounced, then compile the assembled blueprint.
    expect(sceneManager.compile).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();

    expect(sceneManager.compile).toHaveBeenCalledTimes(1);
    const blueprint = sceneManager.compile.mock.calls[0]![0];
    expect(blueprint.extraUniforms).toEqual(['tint']);
    expect(blueprint.fragment).toContain('uniform vec3 tint; // color (RGB)');
    expect(blueprint.fragment).toContain(
      '// <<< end ShaderForge user data >>>',
    );

    wrapper.unmount();
  });

  it('binds a value edit live without recompiling', async () => {
    const wrapper = await mountView();
    await tab(wrapper, 'User data').trigger('click');

    await wrapper.find('.user-data__new-name').setValue('tint');
    await wrapper.find('.user-data__new-kind').setValue('color');
    await wrapper.find('.user-data__add').trigger('submit');
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();
    sceneManager.compile.mockClear();

    wrapper
      .find('.user-data__row')
      .findComponent(UserColorPicker)
      .vm.$emit('change', { r: 0, g: 1, b: 0 });
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();

    // Value edits never request a compile.
    expect(sceneManager.compile).not.toHaveBeenCalled();

    // The next explicit compile reflects the edit in the values comment.
    await tab(wrapper, 'Fragment').trigger('click');
    await wrapper.find('.editor-toolbar__compile').trigger('click');
    await flushPromises();

    const lastCall = sceneManager.compile.mock.calls[0]![0];
    expect(lastCall.extraUniforms).toEqual(['tint']);
    expect(lastCall.fragment).toContain(
      '// current values: tint = (0, 1, 0)',
    );

    wrapper.unmount();
  });

  it('rejects an invalid name before creating a row', async () => {
    const wrapper = await mountView();
    await tab(wrapper, 'User data').trigger('click');

    await wrapper.find('.user-data__new-name').setValue('9lives');
    await wrapper.find('.user-data__add').trigger('submit');
    await nextTick();

    expect(wrapper.findAll('.user-data__row')).toHaveLength(0);
    expect(wrapper.find('.user-data__add-error').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(300);
    expect(sceneManager.compile).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
