import { onBeforeUnmount, reactive, ref, watch } from 'vue';

import type { CompileResult } from '@/core/models/compileResult';
import type { EditorTabId } from '@/core/models/editorTab';
import type { PostEffectStack, TonemapMode } from '@/core/models/postEffect';
import type { ShaderError } from '@/core/models/shaderError';
import {
  SANDBOX_RESERVED_UNIFORM_NAMES,
  defaultSandboxFragmentShader,
  sandboxVertexSource,
} from '@/core/constants/sandbox';
import { findSandboxExample } from '@/core/constants/sandboxExamples';
import { findPostEffectExample } from '@/core/constants/postEffectExamples';
import { createEmptyUserDataDocument } from '@/core/models/userUniform';
import { buildSandboxPostEffectSource } from '@/core/shader/postEffectCodegen';
import {
  generateSandboxFragmentBlock,
  generateSandboxPostBlock,
} from '@/core/shader/uniformCodegen';
import { buildSandboxBlueprint } from '@/core/userdata/userData';
import { EditorManager } from '@/services/codemirror/EditorManager';
import { SandboxPreview } from '@/services/sandbox/SandboxPreview';
import { UserDataController } from '@/services/userdata/UserDataController';
import { usePostEffects } from './usePostEffects';
import { useShaderCompilation } from './useShaderCompilation';
import { useUserDataCommands } from './useUserDataCommands';

/** The sandbox documents: base fragment, user-data panel and post effects. */
export type SandboxTabId = 'fragment' | 'user_data' | 'post';

export interface UseSandboxEditorOptions {
  /** Document to show when the editor mounts; defaults to the fragment. */
  readonly initialTab?: SandboxTabId;
  /** Bundled sandbox example to load before the first compile. */
  readonly initialExample?: string | null;
  /** Bundled post-effect example to load into the active stack slot. */
  readonly initialEffect?: string | null;
  /** Inline fragment source from a `/sandbox?code=…` deep link. */
  readonly initialCode?: string | null;
}

/**
 * State and lifecycle for the 2D sandbox harness. It owns the text editor, the
 * fullscreen preview, the user-data document and the post-effect stack.
 *
 * The shared compilation queue and post-effect stack are the same ones the 3D
 * editor uses; only the renderer (WebGL instead of Babylon) differs.
 */
export function useSandboxEditor(options: UseSandboxEditorOptions = {}) {
  const editorManager = new EditorManager();

  const paused = ref(false);
  const cursorLine = ref(1);
  const cursorCol = ref(1);
  const activeTab = ref<SandboxTabId>('fragment');
  const highlightedUserRow = ref<number | null>(null);

  const userDataDoc = reactive(createEmptyUserDataDocument());
  let fragmentDoc = defaultSandboxFragmentShader;
  let preview: SandboxPreview | null = null;
  let editorMounted = false;

  const userData = new UserDataController<WebGLTexture>(
    {
      getSources: () => ({
        vertex: sandboxVertexSource,
        fragment:
          activeTab.value === 'fragment'
            ? editorManager.getValue()
            : fragmentDoc,
      }),
      buildBlueprint: buildSandboxBlueprint,
      reservedNames: SANDBOX_RESERVED_UNIFORM_NAMES,
      onCompileRequested: (blueprint) => {
        void compilation.compileMaterial(blueprint).then(() => {
          // Do not let a successful post compile hide a base-shader failure.
          if (compilation.status.value === 'ready') {
            void compilation.compilePostEffects();
          }
        });
      },
    },
    userDataDoc,
  );

  const postEffects = usePostEffects({
    onBeforeEdit: () => storeActiveDocument(),
    applyTonemap: (mode) => preview?.setTonemap(mode),
  });

  // Apply the deep link before the editor mounts, so it is the document the
  // first compile sees. `storeActiveDocument` is a no-op until mount.
  const initialEffect = options.initialEffect
    ? findPostEffectExample(options.initialEffect)
    : undefined;

  if (initialEffect) {
    postEffects.loadIntoActive(initialEffect.fragment, initialEffect.label);
  } else if (options.initialExample) {
    const example = findSandboxExample(options.initialExample);
    if (example) fragmentDoc = example.fragment;
  } else if (options.initialCode) {
    fragmentDoc = options.initialCode;
  }

  const initialTab: SandboxTabId = initialEffect
    ? 'post'
    : (options.initialTab ?? 'fragment');

  const compilation = useShaderCompilation({
    compileMaterial: (blueprint) =>
      Promise.resolve(
        preview
          ? preview.compile(blueprint)
          : unavailable('scene-not-initialized'),
      ),
    compilePostEffects: (stack) =>
      Promise.resolve(
        preview
          ? preview.compilePostEffects(stack)
          : unavailable('scene-not-initialized'),
      ),
    getMaterialBlueprint: () => userData.buildBlueprint(),
    getPostStack: currentPostStack,
    onBeforeCompile: storeActiveDocument,
    onOutcome: applyOutcome,
    onExternalErrors: (errors) => {
      highlightedUserRow.value = firstUserDataRow(errors);
      setDiagnostics();
    },
  });

  const userDataCommands = useUserDataCommands(userData);
  const status = compilation.status;
  const statusMessage = compilation.statusMessage;
  const errors = compilation.errors;

  function storeActiveDocument(): void {
    // The editor buffer does not exist until mount; flushing it earlier would
    // replace the seeded document with an empty string.
    if (!editorMounted) return;

    if (activeTab.value === 'fragment') {
      fragmentDoc = editorManager.getValue();
      return;
    }

    if (activeTab.value === 'post') {
      const effect = postEffects.active.value;
      if (effect) effect.fragment = editorManager.getValue();
    }
  }

  function currentPostStack(): PostEffectStack {
    return {
      tonemap: postEffects.tonemap.value,
      effects: postEffects.effects
        .filter((effect) => effect.enabled)
        .map((effect) => buildSandboxPostEffectSource(userDataDoc, effect)),
    };
  }

  function toDiagnostic(error: ShaderError & { line: number }) {
    return {
      line: error.line,
      column: error.column,
      message: [error.title, error.message, error.advice]
        .filter((part): part is string => Boolean(part))
        .join('\n'),
    };
  }

  function diagnosticsFor(tab: SandboxTabId) {
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

    if (tab === 'fragment') {
      return errors.value
        .filter(
          (error): error is ShaderError & { line: number } =>
            error.stage === 'fragment' && error.line !== null,
        )
        .map(toDiagnostic);
    }

    return [];
  }

  function setDiagnostics(): void {
    editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
  }

  function updateInjectedBlock(): void {
    if (activeTab.value === 'fragment') {
      editorManager.setInjectedBlock(
        generateSandboxFragmentBlock(userDataDoc)?.lines ?? null,
      );
      return;
    }

    if (activeTab.value === 'post') {
      editorManager.setInjectedBlock(
        generateSandboxPostBlock(userDataDoc)?.lines ?? null,
      );
      return;
    }

    editorManager.setInjectedBlock(null);
  }

  function isLocatedError(
    error: ShaderError,
  ): error is ShaderError & { line: number; stage: 'fragment' | 'post' } {
    return (
      error.line !== null &&
      (error.stage === 'fragment' || error.stage === 'post')
    );
  }

  function firstUserDataRow(
    shaderErrors: readonly ShaderError[],
  ): number | null {
    return (
      shaderErrors.find(
        (error) => error.stage === 'user_data' && error.row != null,
      )?.row ?? null
    );
  }

  function applyOutcome(result: CompileResult): void {
    highlightedUserRow.value =
      result.status === 'failed' ? firstUserDataRow(result.errors) : null;

    if (result.status !== 'failed') {
      setDiagnostics();
      return;
    }

    const firstLocated = result.errors.find(isLocatedError);
    if (!firstLocated) {
      setDiagnostics();
      return;
    }

    storeActiveDocument();

    if (firstLocated.stage === 'post') {
      if (firstLocated.effectId && postEffects.has(firstLocated.effectId)) {
        postEffects.select(firstLocated.effectId);
      }
      applyTab('post');
      editorManager.setDiagnostics(diagnosticsFor('post'));
      editorManager.revealPosition(firstLocated.line, firstLocated.column);
      return;
    }

    if (activeTab.value !== 'fragment') applyTab('fragment');
    editorManager.setDiagnostics(diagnosticsFor('fragment'));
    editorManager.revealPosition(firstLocated.line, firstLocated.column);
  }

  function applyTab(tab: SandboxTabId): void {
    activeTab.value = tab;

    if (tab === 'post') {
      compilation.setTarget('post');
      editorManager.setValue(postEffects.active.value?.fragment ?? '');
      editorManager.setReadOnly(false);
      editorManager.setDiagnostics(diagnosticsFor('post'));
      editorManager.setInjectedBlock(
        generateSandboxPostBlock(userDataDoc)?.lines ?? null,
      );
      return;
    }

    if (tab === 'user_data') {
      editorManager.setReadOnly(true);
      editorManager.setInjectedBlock(null);
      return;
    }

    compilation.setTarget('material');
    editorManager.setValue(fragmentDoc);
    editorManager.setReadOnly(false);
    editorManager.setDiagnostics(diagnosticsFor('fragment'));
    editorManager.setInjectedBlock(
      generateSandboxFragmentBlock(userDataDoc)?.lines ?? null,
    );
  }

  function switchTab(tab: EditorTabId): void {
    if (tab !== 'fragment' && tab !== 'user_data' && tab !== 'post') return;
    if (tab === activeTab.value) return;

    storeActiveDocument();
    applyTab(tab);
    compilation.setIdle({
      key: 'editor.status.messages.switchedTab',
      params: { tab },
    });
  }

  function compile(): void {
    void compilation.compile();
  }

  /**
   * Replaces the sandbox fragment with a bundled example or an inline deep
   * link and compiles it. The previous document is discarded on purpose: an
   * example is a new starting point, not a merge.
   */
  function loadCode(code: string, label = 'custom code'): void {
    if (!code.trim()) return;

    fragmentDoc = code;
    compilation.clearErrors();
    highlightedUserRow.value = null;

    if (activeTab.value === 'fragment') {
      editorManager.setValue(code);
      updateInjectedBlock();
    } else {
      applyTab('fragment');
    }

    void compilation.compile().then(() => {
      if (compilation.status.value === 'ready') {
        compilation.setReady({
          key: 'editor.status.messages.loadedExample',
          params: { label },
        });
      }
    });
  }

  function loadExample(id: string): void {
    const example = findSandboxExample(id);
    if (!example) return;
    loadCode(example.fragment, example.label);
  }

  function compilePostEffects(): void {
    void compilation.compilePostEffects();
  }

  /** Loads a bundled post-effect example into the active stack slot. */
  function loadPostEffectExample(id: string): void {
    const example = findPostEffectExample(id);
    if (!example) return;
    loadEffectCode(example.fragment, example.label);
  }

  function loadEffectCode(fragment: string, name = 'Custom effect'): void {
    if (!postEffects.loadIntoActive(fragment, name)) return;

    applyTab('post');
    compilation.clearErrors();
    void compilation.compilePostEffects();
  }

  function selectPostEffect(id: string): void {
    if (!postEffects.has(id)) return;
    if (id === postEffects.activeId.value && activeTab.value === 'post') {
      return;
    }

    postEffects.select(id);
    applyTab('post');
    compilation.setIdle({ key: 'editor.status.messages.postEffectSelected' });
  }

  function addPostEffect(): void {
    postEffects.add();
    applyTab('post');
    void compilation.compilePostEffects();
  }

  function removePostEffect(id: string): void {
    if (!postEffects.remove(id)) return;
    if (activeTab.value === 'post') applyTab('post');
    void compilation.compilePostEffects();
  }

  function movePostEffect(id: string, offset: number): void {
    if (postEffects.move(id, offset)) {
      void compilation.compilePostEffects();
    }
  }

  function setPostEffectEnabled(id: string, enabled: boolean): void {
    if (postEffects.setEnabled(id, enabled)) {
      void compilation.compilePostEffects();
    }
  }

  function setTonemap(mode: TonemapMode): void {
    postEffects.setTonemap(mode);
  }

  function mountEditor(host: HTMLElement): void {
    editorMounted = true;
    editorManager.mount(
      host,
      fragmentDoc,
      (position) => {
        cursorLine.value = position.line;
        cursorCol.value = position.col;
      },
      false,
    );

    applyTab(initialTab);
    compilation.setReady({ key: 'editor.status.messages.editorReady' });
  }

  function mountCanvas(canvas: HTMLCanvasElement): void {
    preview?.dispose();
    preview = new SandboxPreview(canvas);
    preview.attachUserData(userData);

    void compilation.compileMaterial().then(() => {
      if (compilation.status.value === 'ready') {
        void compilation.compilePostEffects();
      }
    });
  }

  function revealError(error: ShaderError): void {
    if (error.stage === 'user_data') {
      if (error.row == null) return;
      storeActiveDocument();
      activeTab.value = 'user_data';
      editorManager.setReadOnly(true);
      editorManager.setInjectedBlock(null);
      highlightedUserRow.value = error.row;
      return;
    }

    if (error.stage === 'post') {
      if (error.line === null) return;

      storeActiveDocument();
      if (error.effectId && postEffects.has(error.effectId)) {
        postEffects.select(error.effectId);
      }
      applyTab('post');
      editorManager.revealPosition(error.line, error.column);
      return;
    }

    if (error.stage !== 'fragment' || error.line === null) return;

    storeActiveDocument();
    applyTab('fragment');
    editorManager.revealPosition(error.line, error.column);
  }

  function togglePaused(): void {
    paused.value = !paused.value;
    preview?.setPaused(paused.value);
  }

  // Definitions and values change the generated declarations and the values
  // comment; the read-only preview follows them immediately.
  watch(() => userDataDoc.revision, updateInjectedBlock);

  onBeforeUnmount(() => {
    editorManager.dispose();
    preview?.dispose();
    preview = null;
    userData.dispose();
  });

  return {
    status,
    statusMessage,
    errors,
    paused,
    cursorLine,
    cursorCol,
    activeTab,
    highlightedUserRow,
    userDataDoc,
    userDataCommands,
    postEffects: postEffects.effects,
    activePostEffectId: postEffects.activeId,
    tonemap: postEffects.tonemap,
    compile,
    compilePostEffects,
    loadCode,
    loadExample,
    loadPostEffectExample,
    loadEffectCode,
    mountEditor,
    mountCanvas,
    switchTab,
    revealError,
    togglePaused,
    selectPostEffect,
    addPostEffect,
    removePostEffect,
    movePostEffect,
    setPostEffectEnabled,
    setTonemap,
  };
}

function unavailable(
  reason: 'scene-not-initialized' | 'scene-disposed',
): CompileResult {
  return { status: 'unavailable', reason };
}
