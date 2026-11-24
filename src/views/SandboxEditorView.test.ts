// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { i18n } from '@/i18n';
import { defaultPostEffectFragment } from '@/core/constants/postEffects';
import { defaultSandboxFragmentShader } from '@/core/constants/sandbox';
import type { CompileResult } from '@/core/models/compileResult';
import type { MaterialBlueprint } from '@/core/models/shaderSource';
import UserColorPicker from '@/components/shader/UserColorPicker.vue';
import SandboxEditorView from './SandboxEditorView.vue';

const { preview, editorManager, texturePicker } = vi.hoisted(() => {
  let result: CompileResult = { status: 'ok' };
  let postResult: CompileResult = { status: 'ok' };
  const preview = {
    attachUserData: vi.fn(),
    compile: vi.fn((_blueprint: MaterialBlueprint) => result),
    compilePostEffects: vi.fn(() => postResult),
    setTonemap: vi.fn(),
    setPaused: vi.fn(),
    dispose: vi.fn(),
    setResult(next: CompileResult) {
      result = next;
    },
    setPostResult(next: CompileResult) {
      postResult = next;
    },
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
  const texturePicker = {
    open: vi.fn(),
    preload: vi.fn(),
    dispose: vi.fn(),
  };

  return { preview, editorManager, texturePicker };
});

vi.mock('@/services/assetpicker/AssetPickerTexturePicker', () => ({
  AssetPickerTexturePicker: class {
    constructor() {
      return texturePicker;
    }
  },
}));

vi.mock('@/services/sandbox/SandboxPreview', () => ({
  SandboxPreview: class {
    constructor() {
      return preview;
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
  const wrapper = mount(SandboxEditorView, {
    global: {
      plugins: [i18n],
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

function lastBlueprint(): MaterialBlueprint {
  const call = preview.compile.mock.calls.at(-1);
  if (!call) throw new Error('expected a compile call');
  return call[0];
}

async function selectTab(
  wrapper: ReturnType<typeof mount>,
  label: string,
): Promise<void> {
  const tab = wrapper
    .findAll('.editor-toolbar__tab')
    .find((button) => button.text().includes(label));
  if (!tab) throw new Error(`tab ${label} not found`);

  await tab.trigger('click');
  await nextTick();
}

describe('SandboxEditorView user data', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
    preview.compile.mockClear();
    preview.compilePostEffects.mockClear();
    preview.setTonemap.mockClear();
    preview.attachUserData.mockClear();
    editorManager.mount.mockClear();
    editorManager.setInjectedBlock.mockClear();
    editorManager.revealPosition.mockClear();
    preview.setResult({ status: 'ok' });
    preview.setPostResult({ status: 'ok' });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('starts on the fragment document and shows the 3D-style data menu', async () => {
    const wrapper = await mountView();

    expect(editorManager.mount).toHaveBeenCalled();
    expect(editorManager.mount.mock.calls[0]?.[1]).toBe(
      defaultSandboxFragmentShader,
    );
    expect(wrapper.find('.user-data').exists()).toBe(false);
    expect(
      (wrapper.find('.sandbox-editor__editor-host').element as HTMLElement)
        .style.display,
    ).not.toBe('none');
    expect(wrapper.findAll('.tab-group__trigger')).toHaveLength(2);

    await selectDocument(wrapper, 'Shader Data', 'User data');

    expect(wrapper.find('.user-data').exists()).toBe(true);
    expect(
      (wrapper.find('.sandbox-editor__editor-host').element as HTMLElement)
        .style.display,
    ).toBe('none');

    wrapper.unmount();
  });

  it('offers only the sandbox-compatible kinds and stages', async () => {
    const wrapper = await mountView();
    await selectDocument(wrapper, 'Shader Data', 'User data');

    const kindValues = wrapper
      .findAll('.user-data__new-kind option')
      .map((option) => (option.element as HTMLOptionElement).value);
    expect(kindValues).not.toContain('samplerCube');
    expect(kindValues).toContain('sampler2D');

    await wrapper.find('.user-data__new-name').setValue('glow');
    await wrapper.find('.user-data__new-kind').setValue('float');
    await wrapper.find('.user-data__add').trigger('submit');
    await nextTick();

    const stageValues = wrapper
      .findAll('.user-data__stages option')
      .map((option) => (option.element as HTMLOptionElement).value);
    expect(stageValues).toEqual(['fragment', 'post', 'both']);

    wrapper.unmount();
  });

  it('rejects names owned by the sandbox ABI', async () => {
    const wrapper = await mountView();
    await selectDocument(wrapper, 'Shader Data', 'User data');

    await wrapper.find('.user-data__new-name').setValue('uTime');
    await wrapper.find('.user-data__add').trigger('submit');
    await nextTick();

    expect(wrapper.findAll('.user-data__row')).toHaveLength(0);
    expect(wrapper.find('.user-data__add-error').exists()).toBe(true);

    wrapper.unmount();
  });

  it('adds a uniform and compiles the sandbox blueprint after the debounce', async () => {
    const wrapper = await mountView();
    await selectDocument(wrapper, 'Shader Data', 'User data');

    await wrapper.find('.user-data__new-name').setValue('tint');
    await wrapper.find('.user-data__new-kind').setValue('color');
    await wrapper.find('.user-data__add').trigger('submit');
    await nextTick();

    preview.compile.mockClear();
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();

    expect(preview.compile).toHaveBeenCalledTimes(1);
    const blueprint = lastBlueprint();
    expect(blueprint.fragment).toContain('uniform vec3 tint; // color (RGB)');
    expect(blueprint.fragment).toContain('// current values: tint = (1, 1, 1)');
    expect(blueprint.editorSource.fragment).not.toContain('uniform vec3 tint;');
    expect(blueprint.userData?.fragment?.injected).not.toBeNull();

    wrapper.unmount();
  });

  it('previews post definitions in the post block', async () => {
    const wrapper = await mountView();
    await selectDocument(wrapper, 'Shader Data', 'User data');

    await wrapper.find('.user-data__new-name').setValue('glow');
    await wrapper.find('.user-data__new-kind').setValue('float');
    await wrapper.find('.user-data__add').trigger('submit');
    await nextTick();
    await wrapper.find('.user-data__stages').setValue('post');
    await nextTick();

    const generated = wrapper.find('.user-data__glsl').text();
    expect(generated).toContain('uniform float glow;');
    expect(generated).toContain('glow = 0');

    wrapper.unmount();
  });

  it('binds a value edit without recompiling', async () => {
    const wrapper = await mountView();
    await selectDocument(wrapper, 'Shader Data', 'User data');

    await wrapper.find('.user-data__new-name').setValue('tint');
    await wrapper.find('.user-data__new-kind').setValue('color');
    await wrapper.find('.user-data__add').trigger('submit');
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();

    preview.compile.mockClear();

    wrapper
      .find('.user-data__row')
      .findComponent(UserColorPicker)
      .vm.$emit('change', { r: 0, g: 1, b: 0 });
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();

    expect(preview.compile).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('renders a sampler row only when the picker port is available', async () => {
    const wrapper = await mountView();
    await selectDocument(wrapper, 'Shader Data', 'User data');

    await wrapper.find('.user-data__new-name').setValue('albedo');
    await wrapper.find('.user-data__new-kind').setValue('sampler2D');
    await wrapper.find('.user-data__add').trigger('submit');
    await nextTick();

    expect(wrapper.findAll('.user-data__row')).toHaveLength(1);
    expect(wrapper.find('.texture-source').exists()).toBe(true);

    wrapper.unmount();
  });

  it('reveals a user-data diagnostic in the table', async () => {
    preview.setResult({
      status: 'failed',
      errors: [
        {
          stage: 'user_data',
          line: null,
          column: null,
          kind: 'type',
          title: 'Type mismatch',
          message: 'cannot convert',
          advice: null,
          row: 0,
        },
      ],
    });

    const wrapper = await mountView();
    await selectDocument(wrapper, 'Shader Data', 'User data');

    await wrapper.find('.user-data__new-name').setValue('tint');
    await wrapper.find('.user-data__new-kind').setValue('color');
    await wrapper.find('.user-data__add').trigger('submit');
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);
    await nextTick();

    expect(wrapper.findAll('.user-data__row')).toHaveLength(1);
    expect(wrapper.find('.user-data__row').classes()).toContain(
      'user-data__row--highlighted',
    );
    const errorButton = wrapper.find('.sandbox-editor__error');
    expect(errorButton.text()).toContain('row 1');

    wrapper.unmount();
  });
});

describe('SandboxEditorView post effects', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
    preview.compile.mockClear();
    preview.compilePostEffects.mockClear();
    preview.setTonemap.mockClear();
    editorManager.mount.mockClear();
    editorManager.setInjectedBlock.mockClear();
    editorManager.revealPosition.mockClear();
    preview.setResult({ status: 'ok' });
    preview.setPostResult({ status: 'ok' });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('opens the post-effect stack in its own tab', async () => {
    const wrapper = await mountView();

    expect(wrapper.find('.post-effects').exists()).toBe(false);
    await selectTab(wrapper, 'Post effect');

    expect(wrapper.find('.post-effects').exists()).toBe(true);
    expect(wrapper.findAll('.post-effects__item')).toHaveLength(1);
    expect(editorManager.setValue).toHaveBeenLastCalledWith(
      defaultPostEffectFragment,
    );

    wrapper.unmount();
  });

  it('adds an effect and recompiles the post stack', async () => {
    const wrapper = await mountView();
    await selectTab(wrapper, 'Post effect');
    preview.compilePostEffects.mockClear();

    await wrapper.find('.post-effects__add').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.post-effects__item')).toHaveLength(2);
    expect(preview.compilePostEffects).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('changes the tonemap without recompiling', async () => {
    const wrapper = await mountView();
    await selectTab(wrapper, 'Post effect');
    preview.compilePostEffects.mockClear();

    await wrapper.find('.post-effects__tonemap select').setValue('aces');

    expect(preview.setTonemap).toHaveBeenCalledWith('aces');
    expect(preview.compilePostEffects).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('preserves the fragment and effect buffers across tabs', async () => {
    const wrapper = await mountView();

    editorManager.setValue('// custom fragment');
    await selectTab(wrapper, 'Post effect');
    editorManager.setValue('// custom effect');

    await selectDocument(wrapper, 'Shader Stages', 'Fragment');

    expect(editorManager.setValue).toHaveBeenLastCalledWith(
      '// custom fragment',
    );

    wrapper.unmount();
  });

  it('reveals a post-effect diagnostic in its effect', async () => {
    preview.setPostResult({
      status: 'failed',
      errors: [
        {
          stage: 'post',
          line: 1,
          column: 2,
          kind: 'type',
          title: 'Type mismatch',
          message: 'cannot convert',
          advice: null,
          effectId: 'effect-1',
        },
      ],
    });

    const wrapper = await mountView();

    expect(wrapper.find('.post-effects').exists()).toBe(true);
    expect(editorManager.revealPosition).toHaveBeenCalledWith(1, 2);
    expect(wrapper.find('.sandbox-editor__error').text()).toContain(
      'Post effect',
    );

    wrapper.unmount();
  });
});
