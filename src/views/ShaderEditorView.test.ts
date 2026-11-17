// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { i18n } from '@/i18n';
import UserColorPicker from '@/components/shader/UserColorPicker.vue';
import { findShaderExample } from '@/core/constants/shaderExamples';
import ShaderEditorView from './ShaderEditorView.vue';

interface BlueprintLike {
  readonly vertex: string;
  readonly fragment: string;
  readonly editorSource: {
    readonly vertex: string;
    readonly fragment: string;
  };
  readonly extraUniforms: readonly string[];
  readonly extraSamplers: readonly string[];
}

const { sceneManager, editorManager, examplePicker } = vi.hoisted(() => {
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
    setInjectedBlock: vi.fn(),
    revealPosition: vi.fn(),
    focus: vi.fn(),
    dispose: vi.fn(),
  };
  const examplePicker = {
    open: vi.fn(),
    preload: vi.fn(),
    dispose: vi.fn(),
  };

  return { sceneManager, editorManager, examplePicker };
});

vi.mock('@/services/assetpicker/AssetPickerExamplePicker', () => ({
  AssetPickerExamplePicker: class {
    constructor() {
      return examplePicker;
    }
  },
}));

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

    // Diagnostics still get the untouched editor text, not the assembled one.
    expect(blueprint.editorSource.fragment).not.toContain('uniform vec3 tint;');

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
    expect(lastCall.fragment).toContain('// current values: tint = (0, 1, 0)');

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

describe('ShaderEditorView example loader', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('replaces both documents and recompiles the picked example', async () => {
    editorManager.setValue.mockClear();
    sceneManager.compile.mockClear();

    const dispose = vi.fn();
    examplePicker.open.mockReturnValue({
      result: Promise.resolve({ status: 'picked', exampleId: 'phong' }),
      ready: Promise.resolve(),
      dispose,
    });

    const wrapper = await mountView();
    const phong = findShaderExample('phong');
    if (!phong) throw new Error('missing phong example');

    await wrapper.find('.example-picker__trigger').trigger('click');
    await flushPromises();

    // The picker session is released as soon as the example is handed over.
    expect(examplePicker.open).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);

    // The vertex buffer is loaded into the editor...
    expect(editorManager.setValue).toHaveBeenCalledWith(phong.vertex);

    // ...and the pair is compiled as one blueprint, with the generated block
    // prepended to the fragment stage.
    expect(sceneManager.compile).toHaveBeenCalledTimes(1);
    const blueprint = sceneManager.compile.mock.calls[0]![0];
    expect(blueprint.fragment).toContain('vec3 diffuse = albedo * NdotL;');

    // Its parameters are seeded into the User data document, so the blueprint
    // carries both the generated declarations and their values.
    expect(blueprint.extraUniforms).toEqual([
      'albedo',
      'specularColor',
      'shininess',
    ]);
    expect(blueprint.fragment).toContain('uniform vec3 albedo; // color (RGB)');
    expect(blueprint.fragment).toContain(
      '// current values: albedo = (0.72, 0.31, 0.22)',
    );
    // The fragment editor document is carried untouched for diagnostics; the
    // active vertex tab is overwritten by the mocked editor's empty buffer.
    expect(blueprint.editorSource.fragment).toBe(phong.fragment);

    expect(wrapper.find('.status-bar__message').text()).toContain(
      'Loaded example: Phong',
    );

    // The declarations are previewed read-only next to the fragment source; the
    // document itself only ever holds the example's text.
    await tab(wrapper, 'Fragment').trigger('click');
    await nextTick();

    const blockCalls = editorManager.setInjectedBlock.mock.calls;
    const fragmentBlock = blockCalls[blockCalls.length - 1]?.[0] as
      readonly string[] | null;
    const fragmentBlockText = fragmentBlock?.join('\n') ?? '';

    expect(fragmentBlockText).toContain('uniform vec3 albedo; // color (RGB)');
    expect(fragmentBlockText).toContain(
      '// current values: albedo = (0.72, 0.31, 0.22)',
    );
    expect(editorManager.setValue).toHaveBeenCalledWith(phong.fragment);

    // The User data tab lists the example's parameters.
    await tab(wrapper, 'User data').trigger('click');
    await nextTick();

    expect(wrapper.findAll('.user-data__row')).toHaveLength(3);
    expect(
      wrapper
        .findAll('.user-data__name')
        .map((input) => (input.element as HTMLInputElement).value),
    ).toEqual(['albedo', 'specularColor', 'shininess']);

    wrapper.unmount();
  });
});
