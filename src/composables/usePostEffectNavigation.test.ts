import { reactive, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import type { PostEffectDocument } from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import { createEmptyUserDataDocument } from '@/core/models/userUniform';
import type { EditorManager } from '@/services/codemirror/EditorManager';
import { usePostEffectNavigation } from './usePostEffectNavigation';

function createEditor(value = 'void main() {}') {
  return {
    getValue: vi.fn(() => value),
    setValue: vi.fn(),
    setReadOnly: vi.fn(),
    setDiagnostics: vi.fn(),
    setInjectedBlock: vi.fn(),
    revealPosition: vi.fn(),
    mount: vi.fn(),
  } as unknown as EditorManager;
}

function setup(initialTab: 'post' | 'user_data' | 'gbuffer' = 'post') {
  const editor = createEditor('// initial');
  const effect: PostEffectDocument = {
    id: 'effect-1',
    name: 'Effect 1',
    enabled: true,
    fragment: '// effect',
  };
  const activeId = ref('effect-1');
  const active = ref<PostEffectDocument | null>(effect);
  const errors = ref<ShaderError[]>([]);
  const select = vi.fn();
  const navigation = usePostEffectNavigation({
    editorManager: editor,
    userDataDoc: reactive(createEmptyUserDataDocument()),
    errors,
    effects: {
      activeId,
      active,
      has: (id) => id === 'effect-1',
      select,
    },
    compilation: {
      setTarget: vi.fn(),
      setIdle: vi.fn(),
      setReady: vi.fn(),
    },
    initialTab,
  });

  return { editor, effect, active, errors, select, navigation };
}

describe('post-effect navigation', () => {
  it('mounts the selected effect fragment', () => {
    const { editor, navigation } = setup();

    navigation.mountEditor({} as HTMLElement);

    expect(editor.mount).toHaveBeenCalledWith(
      expect.anything(),
      '// effect',
      expect.any(Function),
      false,
    );
    expect(editor.setValue).toHaveBeenCalledWith('// effect');
    expect(navigation.activeTab.value).toBe('post');
  });

  it('stores edits back into the effect document', () => {
    const { editor, effect, navigation } = setup();
    vi.mocked(editor.getValue).mockReturnValue('// edited');

    navigation.storeActiveDocument();

    expect(effect.fragment).toBe('// edited');
  });

  it('switches to a read-only pane without losing the post document', () => {
    const { editor, effect, navigation } = setup();
    vi.mocked(editor.getValue).mockReturnValue('// edited');

    navigation.switchTab('gbuffer');

    expect(effect.fragment).toBe('// edited');
    expect(navigation.activeTab.value).toBe('gbuffer');
    expect(editor.setReadOnly).toHaveBeenLastCalledWith(true);
    expect(editor.setInjectedBlock).toHaveBeenLastCalledWith(null);
  });

  it('selects the offending effect and reveals a compiler line', () => {
    const { editor, navigation, errors, select } = setup('gbuffer');
    errors.value = [
      {
        stage: 'post',
        line: 4,
        column: 2,
        kind: 'syntax',
        title: 'Syntax error',
        message: 'unexpected token',
        advice: null,
        effectId: 'effect-1',
      },
    ];

    navigation.revealError(errors.value[0]);

    expect(select).toHaveBeenCalledWith('effect-1');
    expect(navigation.activeTab.value).toBe('post');
    expect(editor.revealPosition).toHaveBeenCalledWith(4, 2);
  });

  it('routes user-data diagnostics to the table', () => {
    const { navigation, errors } = setup();
    errors.value = [
      {
        stage: 'user_data',
        line: null,
        column: null,
        kind: 'internal',
        title: 'Bad uniform',
        message: 'reserved',
        advice: null,
        row: 3,
      },
    ];

    navigation.revealError(errors.value[0]);

    expect(navigation.activeTab.value).toBe('user_data');
    expect(navigation.highlightedUserRow.value).toBe(3);
  });
});
