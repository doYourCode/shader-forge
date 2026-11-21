import { ref, watch } from 'vue';
import type { Ref } from 'vue';

import type {
  EditorDiagnostic,
  EditorManager,
} from '@/services/codemirror/EditorManager';
import type { CompileResult } from '@/core/models/compileResult';
import type { EditorTabId } from '@/core/models/editorTab';
import type { PostEffectDocument } from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import type { ShaderSource } from '@/core/models/shaderSource';
import type { UserDataDocument } from '@/core/models/userUniform';
import {
  defaultVertexShader,
  defaultFragmentShader,
  defaultUniformsDoc,
  defaultIoDoc,
} from '@/core/constants/defaultShaders';
import { assembleStage, generateBlock } from '@/core/shader/uniformCodegen';
import { buildPostEffectSource } from '@/core/shader/postEffectCodegen';
import type {
  CompileTarget,
  EditorStatusMessage,
} from './useShaderCompilation';

type EditableTabId = 'vertex' | 'fragment';
type TextTabId = 'vertex' | 'fragment' | 'uniforms' | 'io';

/**
 * The slice of the effect stack navigation reads: the open document, and the
 * operations that change which document the Post effect tab shows.
 */
export interface EditorNavigationPostEffects {
  readonly activeId: Readonly<Ref<string>>;
  readonly active: Readonly<Ref<PostEffectDocument | null>>;
  readonly has: (id: string) => boolean;
  readonly select: (id: string) => boolean;
}

/**
 * The compilation commands navigation drives. The queue itself stays with the
 * compilation composable; navigation only publishes a target and status text.
 */
export interface EditorNavigationCompilation {
  readonly setTarget: (target: CompileTarget) => void;
  readonly setIdle: (message: EditorStatusMessage) => void;
  readonly setReady: (message: EditorStatusMessage) => void;
}

export interface EditorNavigationDeps {
  readonly editorManager: EditorManager;
  /** The live user-data document the injected-block preview is generated from. */
  readonly userDataDoc: UserDataDocument;
  /** Diagnostics owned by the compilation composable. */
  readonly errors: Readonly<Ref<readonly ShaderError[]>>;
  readonly postEffects: EditorNavigationPostEffects;
  readonly compilation: EditorNavigationCompilation;
}

/**
 * Owns editor navigation: the active tab, the text buffers behind each tab, the
 * diagnostics shown for the open document, and where a failure is revealed.
 *
 * It is deliberately passive. Every collaborator is supplied by the editor
 * coordinator, so this module constructs no manager, engine or compile queue;
 * it keeps only the view state navigation itself needs (tab, buffers, cursor
 * and the highlighted user-data row). Creation is circular with those
 * collaborators, so the caller resolves it with lazy closures.
 */
export function useEditorNavigation(deps: EditorNavigationDeps) {
  const { editorManager, userDataDoc, errors, postEffects, compilation } = deps;

  const activeTab = ref<EditorTabId>('fragment');
  const cursorLine = ref(1);
  const cursorCol = ref(1);
  const highlightedUserRow = ref<number | null>(null);

  const tabDocs: Record<TextTabId, string> = {
    vertex: defaultVertexShader,
    fragment: defaultFragmentShader,
    uniforms: defaultUniformsDoc,
    io: defaultIoDoc,
  };

  function currentSources(): ShaderSource {
    return { vertex: tabDocs.vertex, fragment: tabDocs.fragment };
  }

  function isEditableTab(tab: EditorTabId): tab is EditableTabId {
    return tab === 'vertex' || tab === 'fragment';
  }

  function storeActiveDocument(): void {
    if (activeTab.value === 'post') {
      const effect = postEffects.active.value;
      if (effect) effect.fragment = editorManager.getValue();
      return;
    }

    if (isEditableTab(activeTab.value)) {
      tabDocs[activeTab.value] = editorManager.getValue();
    }
  }

  function toDiagnostic(
    error: ShaderError & { line: number },
  ): EditorDiagnostic {
    return {
      line: error.line,
      column: error.column,
      message: [error.title, error.message, error.advice]
        .filter((part): part is string => Boolean(part))
        .join('\n'),
    };
  }

  function diagnosticsFor(tab: EditorTabId): EditorDiagnostic[] {
    if (tab === 'post') {
      return errors.value
        .filter(
          (error): error is ShaderError & { line: number } =>
            error.stage === 'post' &&
            error.effectId === postEffects.activeId.value &&
            error.line !== null,
        )
        .map(toDiagnostic);
    }

    if (!isEditableTab(tab)) return [];

    return errors.value
      .filter(
        (error): error is ShaderError & { line: number } =>
          error.stage === tab && error.line !== null,
      )
      .map(toDiagnostic);
  }

  function firstUserDataRow(
    shaderErrors: readonly ShaderError[],
  ): number | null {
    const match = shaderErrors.find(
      (error) => error.stage === 'user_data' && error.row != null,
    );

    return match?.row ?? null;
  }

  function applyTab(tab: EditorTabId): void {
    activeTab.value = tab;

    if (tab === 'post') {
      compilation.setTarget('post');
      editorManager.setValue(postEffects.active.value?.fragment ?? '');
      editorManager.setReadOnly(false);
      editorManager.setDiagnostics(diagnosticsFor('post'));
      editorManager.setInjectedBlock(
        generateBlock(userDataDoc, 'post')?.lines ?? null,
      );
      return;
    }

    if (tab === 'user_data') {
      // The structured panel replaces the text editor. Leaving the editor
      // buffer alone keeps the exact document when switching back.
      editorManager.setReadOnly(true);
      editorManager.setInjectedBlock(null);
      return;
    }

    compilation.setTarget('material');

    const readOnly = !isEditableTab(tab);
    editorManager.setValue(tabDocs[tab]);
    editorManager.setReadOnly(readOnly);
    editorManager.setDiagnostics(diagnosticsFor(tab));
    editorManager.setInjectedBlock(injectedBlockFor(tab));
  }

  /**
   * Lines the editor previews above the source for a stage: the same generated
   * block the compiler injects. It is read from the live document rather than
   * the last compile, so value edits that bind without a recompile (and the
   * values comment) stay truthful.
   */
  function injectedBlockFor(tab: EditorTabId): readonly string[] | null {
    if (tab === 'post') {
      return generateBlock(userDataDoc, 'post')?.lines ?? null;
    }

    if (!isEditableTab(tab)) return null;

    return generateBlock(userDataDoc, tab)?.lines ?? null;
  }

  function updateInjectedBlock(): void {
    editorManager.setInjectedBlock(injectedBlockFor(activeTab.value));
  }

  /**
   * Exactly the source compiled for the open document: the editor text with the
   * generated user-data block injected at the shared insertion point.
   *
   * Resolved on demand rather than cached so unflushed keystrokes and live value
   * edits are included, and so the copy can never drift from what a compile of
   * the active stage would use.
   */
  function clipboardSource(): string {
    const tab = activeTab.value;

    if (tab === 'user_data') return '';

    storeActiveDocument();

    if (tab === 'post') {
      const effect = postEffects.active.value;
      return effect ? buildPostEffectSource(userDataDoc, effect).fragment : '';
    }

    if (!isEditableTab(tab)) return tabDocs[tab];

    return assembleStage(tabDocs[tab], generateBlock(userDataDoc, tab)).source;
  }

  // Definitions and values change the generated declarations and the values
  // comment; the preview follows them immediately.
  watch(() => userDataDoc.revision, updateInjectedBlock);

  function mountEditor(host: HTMLElement): void {
    const initialTab = isEditableTab(activeTab.value)
      ? activeTab.value
      : 'vertex';

    editorManager.mount(
      host,
      tabDocs[initialTab],
      (pos) => {
        cursorLine.value = pos.line;
        cursorCol.value = pos.col;
      },
      false,
    );

    updateInjectedBlock();

    compilation.setReady({ key: 'editor.status.messages.editorReady' });
  }

  /**
   * Applies a compile outcome: a failed batch highlights its first user-data
   * row, then the editor is routed to the first located failure.
   */
  function applyOutcome(result: CompileResult): void {
    highlightedUserRow.value =
      result.status === 'failed' ? firstUserDataRow(result.errors) : null;

    revealOutcome(result);
  }

  function revealOutcome(result: CompileResult): void {
    if (result.status !== 'failed') {
      editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
      return;
    }

    const firstLocated = result.errors.find(isLocatedError);

    if (!firstLocated) {
      editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
      return;
    }

    // Persist whatever is currently in the editor (the user may have switched
    // tabs while the shader was compiling) before jumping to the error.
    storeActiveDocument();

    if (firstLocated.stage === 'post') {
      revealPostEffectError(firstLocated);
      return;
    }

    if (firstLocated.stage !== activeTab.value) {
      applyTab(firstLocated.stage);
    } else {
      editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
    }

    editorManager.revealPosition(firstLocated.line, firstLocated.column);
  }

  /**
   * Driver-time failures arrive outside a compile outcome, so only the current
   * tab's diagnostics and the highlighted user-data row are refreshed.
   */
  function applyExternalErrors(shaderErrors: readonly ShaderError[]): void {
    highlightedUserRow.value = firstUserDataRow(shaderErrors);
    editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
  }

  function isLocatedError(error: ShaderError): error is ShaderError & {
    line: number;
    stage: 'vertex' | 'fragment' | 'post';
  } {
    if (error.line === null) return false;
    return (
      error.stage === 'vertex' ||
      error.stage === 'fragment' ||
      error.stage === 'post'
    );
  }

  function revealPostEffectError(error: ShaderError & { line: number }): void {
    const effectId = error.effectId;
    if (effectId && postEffects.has(effectId)) {
      postEffects.select(effectId);
    }

    if (activeTab.value !== 'post') {
      applyTab('post');
    } else {
      editorManager.setDiagnostics(diagnosticsFor('post'));
    }

    editorManager.revealPosition(error.line, error.column);
  }

  function revealError(error: ShaderError) {
    if (error.stage === 'post') {
      if (error.line === null) return;
      storeActiveDocument();
      revealPostEffectError({ ...error, line: error.line });
      return;
    }

    if (error.stage === 'user_data') {
      if (error.row == null) return;

      if (activeTab.value !== 'user_data') {
        storeActiveDocument();
        applyTab('user_data');
      }
      // The only place a specific row is highlighted; compile outcomes and
      // external errors highlight the first reported user-data row instead.
      highlightedUserRow.value = error.row;
      return;
    }

    if (error.stage !== 'vertex' && error.stage !== 'fragment') return;

    storeActiveDocument();

    if (error.stage !== activeTab.value) {
      applyTab(error.stage);
    }

    if (error.line !== null) {
      editorManager.revealPosition(error.line, error.column);
    }
  }

  function switchTab(tab: EditorTabId): void {
    if (tab === activeTab.value) return;

    storeActiveDocument();
    applyTab(tab);

    compilation.setIdle({
      key: 'editor.status.messages.switchedTab',
      params: { tab },
    });
  }

  /** Replaces both editable buffers; the caller owns user data and compilation. */
  function replaceDocuments(sources: ShaderSource): void {
    tabDocs.vertex = sources.vertex;
    tabDocs.fragment = sources.fragment;
  }

  /** Clears the user-data highlight without touching diagnostics or the tab. */
  function clearHighlightedRow(): void {
    highlightedUserRow.value = null;
  }

  return {
    activeTab,
    cursorLine,
    cursorCol,
    highlightedUserRow,
    currentSources,
    isEditableTab,
    storeActiveDocument,
    applyTab,
    switchTab,
    clipboardSource,
    mountEditor,
    applyOutcome,
    applyExternalErrors,
    revealError,
    replaceDocuments,
    clearHighlightedRow,
  };
}

export type EditorNavigation = ReturnType<typeof useEditorNavigation>;
