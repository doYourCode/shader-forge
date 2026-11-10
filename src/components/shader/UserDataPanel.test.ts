// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import { i18n } from '@/i18n';
import {
  GLSL_RESERVED_WORDS,
  validateUniformName,
  type NameValidationResult,
  type UserUniformDefinition,
} from '@/core/models/userUniform';
import UserDataPanel from './UserDataPanel.vue';
import UniformValueInput from './UniformValueInput.vue';
import UserColorPicker from './UserColorPicker.vue';

const RESERVED = new Set<string>(['time', ...GLSL_RESERVED_WORDS]);

function createDefinition(
  id: string,
  name: string,
  overrides: Partial<UserUniformDefinition> = {},
): UserUniformDefinition {
  return {
    id,
    name,
    kind: 'color',
    stages: 'fragment',
    value: { r: 1, g: 1, b: 1 },
    ...overrides,
  };
}

function createValidateName(
  definitions: readonly UserUniformDefinition[],
) {
  return (name: string, exceptId?: string): NameValidationResult => {
    const taken = new Set(
      definitions
        .filter((definition) => definition.id !== exceptId)
        .map((definition) => definition.name),
    );
    return validateUniformName(name, taken, RESERVED);
  };
}

function mountPanel(definitions: UserUniformDefinition[] = []) {
  return mount(UserDataPanel, {
    props: {
      definitions,
      highlightedRow: null,
      validateName: createValidateName(definitions),
    },
    global: { plugins: [i18n] },
  });
}

afterEach(() => {
  // Teleported color panels live in body, outside the wrapper.
  document.body.innerHTML = '';
});

describe('UserDataPanel', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  it('shows the empty state when no uniform is declared', () => {
    const wrapper = mountPanel();

    expect(wrapper.find('.user-data__empty').exists()).toBe(true);
    expect(wrapper.find('.user-data__table').exists()).toBe(false);
  });

  it('renders one row per definition', () => {
    const wrapper = mountPanel([
      createDefinition('u1', 'tint'),
      createDefinition('u2', 'scale', {
        kind: 'float',
        value: 2,
        stages: 'both',
      }),
    ]);

    const rows = wrapper.findAll('.user-data__row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.find('.user-data__name').element).toHaveProperty(
      'value',
      'tint',
    );
    expect(rows[1]!.find('.user-data__kind').element).toHaveProperty(
      'value',
      'float',
    );
    expect(rows[1]!.find('.user-data__stages').element).toHaveProperty(
      'value',
      'both',
    );
  });

  it('emits an add intent with the typed name and kind', async () => {
    const wrapper = mountPanel();

    await wrapper.find('.user-data__new-name').setValue('tint');
    await wrapper.find('.user-data__new-kind').setValue('color');
    await wrapper.find('.user-data__add').trigger('submit');

    expect(wrapper.emitted('add')?.[0]).toEqual([
      { name: 'tint', kind: 'color' },
    ]);
    expect(wrapper.find('.user-data__new-name').element).toHaveProperty(
      'value',
      '',
    );
  });

  it('rejects an invalid name before emitting anything', async () => {
    const wrapper = mountPanel();

    await wrapper.find('.user-data__new-name').setValue('9lives');
    await wrapper.find('.user-data__add').trigger('submit');

    expect(wrapper.emitted('add')).toBeUndefined();
    expect(wrapper.find('.user-data__add-error').text()).toContain(
      'GLSL identifier',
    );
  });

  it('rejects a reserved name before emitting anything', async () => {
    const wrapper = mountPanel();

    await wrapper.find('.user-data__new-name').setValue('time');
    await wrapper.find('.user-data__add').trigger('submit');

    expect(wrapper.emitted('add')).toBeUndefined();
    expect(wrapper.find('.user-data__add-error').text()).toContain('reserved');
  });

  it('commits a rename on Enter', async () => {
    const wrapper = mountPanel([createDefinition('u1', 'tint')]);

    const input = wrapper.find('.user-data__name');
    await input.setValue('accent');
    await input.trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('rename')?.[0]).toEqual(['u1', 'accent']);
  });

  it('rejects a reserved rename and restores the stored name', async () => {
    const wrapper = mountPanel([createDefinition('u1', 'tint')]);

    const input = wrapper.find('.user-data__name');
    await input.setValue('time');
    await input.trigger('blur');

    expect(wrapper.emitted('rename')).toBeUndefined();
    expect(wrapper.find('.user-data__row-error').text()).toContain('reserved');
    expect(wrapper.find('.user-data__name').element).toHaveProperty(
      'value',
      'tint',
    );
  });

  it('emits kind, stage and remove intents for a row', async () => {
    const wrapper = mountPanel([createDefinition('u1', 'tint')]);

    await wrapper.find('.user-data__kind').setValue('float');
    await wrapper.find('.user-data__stages').setValue('vertex');
    await wrapper.find('.user-data__remove').trigger('click');

    expect(wrapper.emitted('change-kind')?.[0]).toEqual(['u1', 'float']);
    expect(wrapper.emitted('change-stages')?.[0]).toEqual(['u1', 'vertex']);
    expect(wrapper.emitted('remove')?.[0]).toEqual(['u1']);
  });

  it('forwards value edits from the per-kind widget', async () => {
    const wrapper = mountPanel([createDefinition('u1', 'tint')]);

    expect(wrapper.findComponent(UniformValueInput).props('label')).toBe(
      'tint',
    );
    expect(wrapper.findComponent(UserColorPicker).props('label')).toBe(
      'tint',
    );

    wrapper.findComponent(UserColorPicker).vm.$emit('change', {
      r: 0,
      g: 0,
      b: 0,
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('change-value')?.[0]).toEqual([
      'u1',
      { r: 0, g: 0, b: 0 },
    ]);
  });

  it('highlights the row blamed by a diagnostic', () => {
    const wrapper = mount(UserDataPanel, {
      props: {
        definitions: [
          createDefinition('u1', 'tint'),
          createDefinition('u2', 'scale'),
        ],
        highlightedRow: 1,
        validateName: createValidateName([]),
      },
      global: { plugins: [i18n] },
    });

    const rows = wrapper.findAll('.user-data__row');
    expect(rows[0]!.classes()).not.toContain(
      'user-data__row--highlighted',
    );
    expect(rows[1]!.classes()).toContain('user-data__row--highlighted');
  });
});

describe('UserDataPanel generated GLSL preview', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });

  function previewText(wrapper: ReturnType<typeof mountPanel>): string {
    return wrapper
      .findAll('.user-data__glsl')
      .map((block) => block.text())
      .join('\n');
  }

  it('shows the managed block that would be injected into the fragment stage', () => {
    const wrapper = mountPanel([createDefinition('u1', 'tint')]);

    const text = previewText(wrapper);

    expect(text).toContain('// >>> ShaderForge user data');
    expect(text).toContain('uniform vec3 tint; // color (RGB)');
    expect(text).toContain('// current values: tint = (1, 1, 1)');
    expect(text).toContain('// <<< end ShaderForge user data >>>');
    expect(
      wrapper.findAll('.user-data__generated-stage').map((title) => title.text()),
    ).toEqual(['Fragment stage']);
  });

  it('never shows uniform initializers', () => {
    const wrapper = mountPanel([
      createDefinition('u1', 'tint', { value: { r: 1, g: 0, b: 0 } }),
      createDefinition('u2', 'scale', { kind: 'float', value: 2 }),
    ]);

    const declarations = previewText(wrapper)
      .split('\n')
      .filter((line) => line.startsWith('uniform '));

    expect(declarations).toHaveLength(2);
    for (const line of declarations) {
      expect(line).not.toContain('=');
    }
  });

  it('refreshes the values comment when a value changes', async () => {
    const wrapper = mountPanel([createDefinition('u1', 'tint')]);
    expect(previewText(wrapper)).toContain('(1, 1, 1)');

    await wrapper.setProps({
      definitions: [
        createDefinition('u1', 'tint', {
          value: { r: 0, g: 0.5, b: 0 },
        }),
      ],
    });

    expect(previewText(wrapper)).toContain('// current values: tint = (0, 0.5, 0)');
  });

  it('shows a vertex block only for vertex-targeted definitions', () => {
    const wrapper = mountPanel([
      createDefinition('u1', 'sunDir', {
        kind: 'direction',
        stages: 'vertex',
      }),
    ]);

    expect(
      wrapper.findAll('.user-data__generated-stage').map((title) => title.text()),
    ).toEqual(['Vertex stage']);
    expect(previewText(wrapper)).toContain(
      'uniform vec3 sunDir; // direction (normalized)',
    );
  });

  it('shows both blocks when a definition targets both stages', () => {
    const wrapper = mountPanel([
      createDefinition('u1', 'tint', { stages: 'both' }),
    ]);

    expect(
      wrapper.findAll('.user-data__generated-stage').map((title) => title.text()),
    ).toEqual(['Fragment stage', 'Vertex stage']);
    expect(wrapper.findAll('.user-data__glsl')).toHaveLength(2);
  });

  it('explains that the preview is empty instead of rendering a blank block', () => {
    const wrapper = mountPanel();

    expect(wrapper.find('.user-data__generated-empty').exists()).toBe(true);
    expect(wrapper.find('.user-data__glsl').exists()).toBe(false);
  });

  it('states that the block is injected into the compiled source, not the editor', () => {
    const wrapper = mountPanel([createDefinition('u1', 'tint')]);

    expect(wrapper.find('.user-data__generated-note').text()).toContain(
      'injected into the source that is compiled',
    );
  });
});
