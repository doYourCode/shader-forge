import { ref, watch, type Ref } from 'vue';

import type { CompileResult } from '@/core/models/compileResult';
import type { PostEffectDocument } from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import type { UserDataDocument } from '@/core/models/userUniform';
import { buildPostEffectSource } from '@/core/shader/postEffectCodegen';
import { generateBlock } from '@/core/shader/uniformCodegen';
import type {
  EditorDiagnostic,
  EditorManager,
} from '@/services/codemirror/EditorManager';

export type ScreenSpaceTab = 'post' | 'user_data' | 'gbuffer';

export interface PostEffectNavigationEffects {
  readonly activeId: Readonly<Ref<string>>;
  readonly active: Readonly<Ref<PostEffectDocument | null>>;
  readonly has: (id: string) => boolean;
  readonly select: (id: string) => boolean;
}

export interface PostEffectNavigationCompilation {
  readonly setTarget: (target: 'post') => void;
  readonly setIdle: (message: {
    key: string;
    params?: Record<string, unknown>;
  }) => void;
  readonly setReady: (message: {
    key: string;
    params?: Record<string, unknown>;
  }) => void;
}

export interface PostEffectNavigationDeps {
  readonly editorManager: EditorManager;
  readonly userDataDoc: UserDataDocument;
  readonly errors: Readonly<Ref<readonly ShaderError[]>>;
  readonly effects: PostEffectNavigationEffects;
  readonly compilation: PostEffectNavigationCompilation;
  readonly initialTab?: ScreenSpaceTab;
}

/**
 * Editor navigation for the screen-space editor.
 *
 * There are only three panes: the selected effect's fragment, the post-stage
 * user-data table, and the G-buffer reference/debug pane. Each effect keeps its
 * own fragment in the document model, so switching effects preserves edits.
 */
export function usePostEffectNavigation(deps: PostEffectNavigationDeps) {
  const { editorManager, userDataDoc, errors, effects, compilation } = deps;
  const activeTab = ref<ScreenSpaceTab>(deps.initialTab ?? 'post');
  const cursorLine = ref(1);
  const cursorCol = ref(1);
  const highlightedUserRow = ref<number | null>(null);

  function storeActiveDocument(): void {
    if (activeTab.value !== 'post') return;

    const effect = effects.active.value;
    if (effect) effect.fragment = editorManager.getValue();
  }

  function diagnosticsFor(tab: ScreenSpaceTab): EditorDiagnostic[] {
    if (tab !== 'post') return [];

    return errors.value
      .filter(
        (error): error is ShaderError & { line: number } =>
          error.stage === 'post' &&
          error.effectId === effects.activeId.value &&
          error.line !== null,
      )
      .map((error) => ({
        line: error.line,
        column: error.column,
        message: [error.title, error.message, error.advice]
          .filter((part): part is string => Boolean(part))
          .join('\n'),
      }));
  }

  function injectedBlock(): readonly string[] | null {
    return generateBlock(userDataDoc, 'post')?.lines ?? null;
  }

  function applyTab(tab: ScreenSpaceTab): void {
    activeTab.value = tab;
    compilation.setTarget('post');

    if (tab === 'post') {
      editorManager.setValue(effects.active.value?.fragment ?? '');
      editorManager.setReadOnly(false);
      editorManager.setDiagnostics(diagnosticsFor('post'));
      editorManager.setInjectedBlock(injectedBlock());
      return;
    }

    editorManager.setReadOnly(true);
    editorManager.setInjectedBlock(null);
  }

  function switchTab(tab: ScreenSpaceTab): void {
    if (tab === activeTab.value) return;

    storeActiveDocument();
    applyTab(tab);
    compilation.setIdle({
      key: 'editor.status.messages.switchedTab',
      params: { tab },
    });
  }

  function mountEditor(host: HTMLElement): void {
    editorManager.mount(
      host,
      effects.active.value?.fragment ?? '',
      (position) => {
        cursorLine.value = position.line;
        cursorCol.value = position.col;
      },
      false,
    );
    applyTab(activeTab.value);
    compilation.setReady({ key: 'editor.status.messages.editorReady' });
  }

  function clipboardSource(): string {
    if (activeTab.value !== 'post') return '';
    storeActiveDocument();

    const effect = effects.active.value;
    return effect ? buildPostEffectSource(userDataDoc, effect).fragment : '';
  }

  function applyOutcome(result: CompileResult): void {
    highlightedUserRow.value =
      result.status === 'failed'
        ? (result.errors.find((error) => error.stage === 'user_data')?.row ??
          null)
        : null;

    if (result.status !== 'failed') {
      editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
      return;
    }

    const firstLocated = result.errors.find(
      (error): error is ShaderError & { line: number } =>
        error.stage === 'post' && error.line !== null,
    );

    if (!firstLocated) {
      editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
      return;
    }

    storeActiveDocument();
    if (firstLocated.effectId && effects.has(firstLocated.effectId)) {
      effects.select(firstLocated.effectId);
    }
    if (activeTab.value !== 'post') {
      applyTab('post');
    } else {
      editorManager.setDiagnostics(diagnosticsFor('post'));
    }
    editorManager.revealPosition(firstLocated.line, firstLocated.column);
  }

  function applyExternalErrors(shaderErrors: readonly ShaderError[]): void {
    highlightedUserRow.value =
      shaderErrors.find((error) => error.stage === 'user_data')?.row ?? null;
    editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
  }

  function revealError(error: ShaderError): void {
    if (error.stage === 'user_data') {
      if (error.row == null) return;
      storeActiveDocument();
      applyTab('user_data');
      highlightedUserRow.value = error.row;
      return;
    }

    if (error.stage !== 'post' || error.line === null) return;

    storeActiveDocument();
    if (error.effectId && effects.has(error.effectId)) {
      effects.select(error.effectId);
    }
    if (activeTab.value !== 'post') applyTab('post');
    editorManager.revealPosition(error.line, error.column);
  }

  function clearErrors(): void {
    editorManager.setDiagnostics([]);
  }

  watch(
    () => userDataDoc.revision,
    () => {
      if (activeTab.value === 'post') {
        editorManager.setInjectedBlock(injectedBlock());
      }
    },
  );

  return {
    activeTab,
    cursorLine,
    cursorCol,
    highlightedUserRow,
    storeActiveDocument,
    applyTab,
    switchTab,
    mountEditor,
    clipboardSource,
    applyOutcome,
    applyExternalErrors,
    revealError,
    clearErrors,
  };
}

export type PostEffectNavigation = ReturnType<typeof usePostEffectNavigation>;
