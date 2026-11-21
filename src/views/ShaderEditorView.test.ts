// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { i18n } from '@/i18n';
import UserColorPicker from '@/components/shader/UserColorPicker.vue';
import { defaultFragmentShader } from '@/core/constants/defaultShaders';
import { defaultPostEffectFragment } from '@/core/constants/postEffects';
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
      status: 'ok' as const,
    })),
    loadModel: vi.fn(async () => true),
    loadEnvironment: vi.fn(async () => true),
    resize: vi.fn(),
    setWireframe: vi.fn(),
    setPaused: vi.fn(),
    dispose: vi.fn(),
  };
  let editorValue = '';
  const editorManager = {
    mount: vi.fn((_parent: unknown, initialDoc: string) => {
      editorValue = initialDoc;
    }),
    getValue: vi.fn(() => editorValue),
    setValue: vi.fn((value: string) => {
      editorValue = value;
    }),
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

async function mountView(props: { initialTab?: 'post' } = {}) {
  const wrapper = mount(ShaderEditorView, {
    props,
    global: {
      plugins: [i18n],
      // The brand is a RouterLink; this view test mounts without a router.
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  });
  await flushPromises();
  return wrapper;
}

async function selectDocument(
  wrapper: ReturnType<typeof mount>,
  groupLabel: string,
  label: string,
): Promise<void> {
  const trigger = wrapper
    .findAll('.tab-group__trigger')
    .find((button) => button.text().includes(groupLabel));
  if (!trigger) throw new Error(`group ${groupLabel} not found`);

  await trigger.trigger('click');
  await nextTick();

  const item = wrapper
    .findAll('[role="menuitemradio"]')
    .find((button) => button.text().includes(label));
  if (!item) throw new Error(`tab ${label} not found`);

  await item.trigger('click');
  await nextTick();
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

    await selectDocument(wrapper, 'Shader Data', 'User data');

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
    await selectDocument(wrapper, 'Shader Data', 'User data');

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
    await selectDocument(wrapper, 'Shader Data', 'User data');

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
    await selectDocument(wrapper, 'Shader Stages', 'Fragment');
    await wrapper.find('.compile-button').trigger('click');
    await flushPromises();

    const lastCall = sceneManager.compile.mock.calls[0]![0];
    expect(lastCall.extraUniforms).toEqual(['tint']);
    expect(lastCall.fragment).toContain('// current values: tint = (0, 1, 0)');

    wrapper.unmount();
  });

  it('rejects an invalid name before creating a row', async () => {
    const wrapper = await mountView();
    await selectDocument(wrapper, 'Shader Data', 'User data');

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

    // The fragment buffer is loaded into the editor...
    expect(editorManager.setValue).toHaveBeenCalledWith(phong.fragment);

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
    // The fragment document is carried into the blueprint for diagnostics.
    expect(blueprint.editorSource.fragment).toBe(phong.fragment);

    expect(wrapper.find('.status-bar__message').text()).toContain(
      'Loaded example: Phong',
    );

    // The declarations are previewed read-only next to the fragment source; the
    // document itself only ever holds the example's text.
    await selectDocument(wrapper, 'Shader Stages', 'Fragment');
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
    await selectDocument(wrapper, 'Shader Data', 'User data');
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

describe('ShaderEditorView chrome', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  afterEach(() => {
    i18n.global.locale.value = 'en';
    document.body.innerHTML = '';
  });

  it('mounts the fragment document by default', async () => {
    editorManager.mount.mockClear();
    const wrapper = await mountView();

    expect(editorManager.mount).toHaveBeenCalledWith(
      expect.anything(),
      defaultFragmentShader,
      expect.any(Function),
      false,
    );

    wrapper.unmount();
  });

  it('opens the requested post document on mount', async () => {
    editorManager.setValue.mockClear();
    const wrapper = await mountView({ initialTab: 'post' });

    expect(wrapper.find('.post-effects').exists()).toBe(true);
    expect(wrapper.find('.editor-toolbar__tab--active').text()).toBe(
      'Post effect',
    );
    expect(editorManager.setValue).toHaveBeenCalledWith(
      defaultPostEffectFragment,
    );

    wrapper.unmount();
  });

  it('keeps the brand left, with compile and language across the split', async () => {
    const wrapper = await mountView();

    const left = wrapper.find('.editor-toolbar');
    const right = wrapper.find('.viewer-toolbar');

    expect(wrapper.find('.app-header').exists()).toBe(false);
    expect(left.find('.app-brand').exists()).toBe(true);
    expect(left.find('.language-switch').exists()).toBe(false);
    expect(left.find('.compile-button').exists()).toBe(false);

    const compile = right.find('.compile-button');
    const language = right.find('.language-switch');

    expect(compile.exists()).toBe(true);
    expect(language.exists()).toBe(true);

    const buttons = right.findAll('.viewer-toolbar__btn');
    const cfg = buttons[0]?.element;
    const pause = buttons[1]?.element;

    if (!cfg || !pause) throw new Error('viewer controls not found');

    expect(
      compile.element.compareDocumentPosition(cfg) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      pause.compareDocumentPosition(language.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    wrapper.unmount();
  });

  it('translates the compile action', async () => {
    i18n.global.locale.value = 'pt-BR';

    const wrapper = await mountView();

    expect(wrapper.find('.compile-button').text()).toContain('Compilar');

    wrapper.unmount();
  });
});
