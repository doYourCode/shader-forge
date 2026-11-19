import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

import {
  EditorManager,
  type EditorDiagnostic,
} from '@/services/codemirror/EditorManager';
import { SceneManager } from '@/services/babylon/SceneManager';
import type { CompileResult } from '@/core/models/compileResult';
import type {
  MaterialBlueprint,
  ShaderSource,
} from '@/core/models/shaderSource';
import type { EditorTabId } from '@/core/models/editorTab';
import type { PostEffectStack, TonemapMode } from '@/core/models/postEffect';
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewModel } from '@/core/models/previewModel';
import type { ShaderError } from '@/core/models/shaderError';
import type {
  UserDataDocument,
  UserUniformKind,
  UserUniformStage,
  UserUniformValue,
} from '@/core/models/userUniform';
import { createEmptyUserDataDocument } from '@/core/models/userUniform';
import { previewModels } from '@/core/constants/previewModels';
import { previewHdris } from '@/core/constants/previewHdris';
import {
  defaultVertexShader,
  defaultFragmentShader,
  defaultUniformsDoc,
  defaultIoDoc,
} from '@/core/constants/defaultShaders';
import { findShaderExample } from '@/core/constants/shaderExamples';
import { assembleStage, generateBlock } from '@/core/shader/uniformCodegen';
import { buildPostEffectSource } from '@/core/shader/postEffectCodegen';
import {
  UserDataController,
  type AddUserUniformResult,
  type UserDataCommandResult,
} from '@/services/userdata/UserDataController';
import { LoadProfiler, exposeProfiler } from '@/services/perf/LoadProfiler';
import {
  useShaderCompilation,
  type EditorStatusMessage,
} from './useShaderCompilation';
import { usePostEffects } from './usePostEffects';
import { useUserDataCommands } from './useUserDataCommands';

export type { EditorStatus } from './useShaderCompilation';

type EditableTabId = 'vertex' | 'fragment';
type TextTabId = 'vertex' | 'fragment' | 'uniforms' | 'io';

/**
 * Composition root of the editor screen.
 *
 * It owns the managers and the tab/document navigation, and wires three focused
 * collaborators: compilation (queue + error/status state), the post-effect stack
 * and the user-data command surface. It deliberately does not implement those
 * concerns itself.
 */
export function useShaderEditor() {
  const editorManager = new EditorManager();
  /**
   * Load-phase instrumentation lives at the composition root: the manager and
   * the environment controller only know the `LoadTimer` port. Dev builds (and
   * `?perf` in production) expose it as `window.__shaderForgePerf`.
   */
  const loadProfiler = new LoadProfiler();
  const profileEnabled =
    typeof window !== 'undefined' &&
    (import.meta.env.DEV ||
      new URLSearchParams(window.location.search).has('perf'));
  if (profileEnabled) exposeProfiler(loadProfiler);

  const sceneManager = new SceneManager(undefined, undefined, loadProfiler);

  const activeTab = ref<EditorTabId>('vertex');
  const activeModel = ref<PreviewModel>(previewModels.default);
  const activeModelId = computed(() => activeModel.value.id);
  const activeHdri = ref<PreviewHdri>(previewHdris.default);
  const activeHdriId = computed(() => activeHdri.value.id);
  const cursorLine = ref(1);
  const cursorCol = ref(1);
  const wireframe = ref(false);
  const paused = ref(false);
  const highlightedUserRow = ref<number | null>(null);
  /** Empty while the preview is idle; drives the canvas loading overlay. */
  const loadingMessage = ref<EditorStatusMessage | null>(null);
  let loadingDepth = 0;

  let confirmedModel = previewModels.default;
  let modelSelection = 0;
  let confirmedHdri = previewHdris.default;
  let hdriSelection = 0;

  function beginLoad(message: EditorStatusMessage): void {
    loadingDepth += 1;
    loadingMessage.value = message;
  }

  function endLoad(): void {
    loadingDepth = Math.max(0, loadingDepth - 1);
    if (loadingDepth === 0) loadingMessage.value = null;
  }

  const tabDocs: Record<TextTabId, string> = {
    vertex: defaultVertexShader,
    fragment: defaultFragmentShader,
    uniforms: defaultUniformsDoc,
    io: defaultIoDoc,
  };

  const userDataDoc: UserDataDocument = reactive(createEmptyUserDataDocument());

  /**
   * The effect stack only knows how to edit itself; it asks the coordinator to
   * flush the buffer and apply the output transform.
   */
  const postEffects = usePostEffects({
    onBeforeEdit: storeActiveDocument,
    applyTonemap: (mode) => sceneManager.setTonemap(mode),
  });

  /**
   * All shader work runs one compile at a time: material and post-effect
   * compilers share the WebGL log recorder, so overlapping batches would
   * misattribute driver diagnostics. The queue is the only entry point.
   */
  const compilation = useShaderCompilation({
    compileMaterial: (blueprint) => sceneManager.compile(blueprint),
    compilePostEffects: (stack) => sceneManager.compilePostEffects(stack),
    getMaterialBlueprint: () => userData.buildBlueprint(currentSources()),
    getPostStack: () => currentPostStack(),
    onBeforeCompile: storeActiveDocument,
    onOutcome: handleOutcome,
    onExternalErrors: handleExternalErrors,
  });

  const userData = new UserDataController(
    {
      getSources: () => currentSources(),
      onCompileRequested: (blueprint) => {
        // A structural edit changes declarations for one of the two document
        // families; recompiling both keeps every generated block truthful.
        void compilation
          .compileMaterial(blueprint)
          .then(() => compilation.compilePostEffects());
      },
    },
    userDataDoc,
  );

  const userDataCommands = useUserDataCommands(userData);

  // Driver-time failures enter the same error state as a compile outcome.
  sceneManager.onError = (shaderErrors) =>
    compilation.reportErrors(shaderErrors);

  const status = compilation.status;
  const statusMessage = compilation.statusMessage;
  const errors = compilation.errors;

  function currentSources(): ShaderSource {
    return { vertex: tabDocs.vertex, fragment: tabDocs.fragment };
  }

  function currentPostStack(): PostEffectStack {
    return {
      tonemap: postEffects.tonemap.value,
      effects: postEffects.effects
        .filter((effect) => effect.enabled)
        .map((effect) => buildPostEffectSource(userDataDoc, effect)),
    };
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
    editorManager.mount(
      host,
      tabDocs.vertex,
      (pos) => {
        cursorLine.value = pos.line;
        cursorCol.value = pos.col;
      },
      false,
    );

    updateInjectedBlock();

    compilation.setReady({ key: 'editor.status.messages.editorReady' });
  }

  function mountCanvas(canvas: HTMLCanvasElement): void {
    beginLoad({ key: 'editor.loading.preview' });

    // init resolves once the mesh, material and environment are ready,
    // which is what the overlay reports; frames may already be clearing the
    // canvas in the meantime (setPaused(false) starts the render loop early).
    void loadProfiler
      .measure('scene:init', () =>
        sceneManager.init(
          canvas,
          userData.buildBlueprint(currentSources()),
          activeModel.value,
          activeHdri.value,
          userData,
          currentPostStack(),
        ),
      )
      .finally(endLoad);

    sceneManager.setPaused(false);
  }

  async function selectModel(id: string) {
    if (id === activeModel.value.id) return;

    const model = previewModels.find(id);
    if (!model) return;

    const request = ++modelSelection;
    const previous = confirmedModel;
    activeModel.value = model;

    beginLoad({ key: 'editor.loading.model' });
    try {
      const loaded = await loadProfiler.measure('model:swap', () =>
        sceneManager.loadModel(model),
      );

      if (loaded) {
        confirmedModel = model;
        return;
      }

      // A newer selection owns the dropdown now; don't revert over it.
      if (request === modelSelection) {
        activeModel.value = previous;
      }
    } finally {
      endLoad();
    }
  }

  async function selectHdri(id: string) {
    if (id === activeHdri.value.id) return;

    const hdri = previewHdris.find(id);
    if (!hdri) return;

    const request = ++hdriSelection;
    const previous = confirmedHdri;
    activeHdri.value = hdri;

    beginLoad({ key: 'editor.loading.environment' });
    try {
      const loaded = await loadProfiler.measure('env:swap', () =>
        sceneManager.loadEnvironment(hdri),
      );

      if (loaded) {
        confirmedHdri = hdri;
        return;
      }

      // A newer selection owns the dropdown now; don't revert over it.
      if (request === hdriSelection) {
        activeHdri.value = previous;
      }
    } finally {
      endLoad();
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

  /**
   * Replaces both editable documents with one example and compiles the pair.
   *
   * Loading is deliberately destructive: the example is a new starting point,
   * not a merge, so the outgoing sources and user-data definitions are
   * discarded. The current editable tab is kept when it can show the source; a
   * built-in reference or the user-data panel falls back to the vertex
   * document.
   */
  function loadExample(exampleId: string): void {
    const example = findShaderExample(exampleId);
    if (!example) return;

    tabDocs.vertex = example.vertex;
    tabDocs.fragment = example.fragment;

    // The example's editable parameters live in the User data document, which
    // generates the declarations its source references and binds the seeded
    // values. Replacing the document (rather than merging) keeps a load
    // deterministic; it is part of the same destructive load as the sources.
    userDataCommands.replaceAll(example.uniforms);

    // Diagnostics belong to the previous source; `applyTab` clears them from
    // the editor and the compile below republishes them for the example.
    compilation.clearErrors();
    highlightedUserRow.value = null;

    applyTab(isEditableTab(activeTab.value) ? activeTab.value : 'vertex');

    void compile().then(() => {
      if (status.value === 'ready') {
        compilation.setReady({
          key: 'editor.status.messages.loadedExample',
          params: { label: example.label },
        });
      }
    });
  }

  /**
   * Compiles the document family being edited. Structural user-data edits pass
   * a blueprint, so they always compile the material.
   */
  function compile(blueprint?: MaterialBlueprint): Promise<void> {
    return blueprint
      ? compilation.compileMaterial(blueprint)
      : compilation.compile();
  }

  function compilePostEffects(): Promise<void> {
    return compilation.compilePostEffects();
  }

  /**
   * Diagnostics and navigation follow every applied outcome. `errors` is
   * already owned by the compilation composable, so this only routes the
   * editor to the first located failure.
   */
  function handleOutcome(result: CompileResult): void {
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

  function handleExternalErrors(shaderErrors: readonly ShaderError[]): void {
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

  function selectPostEffect(id: string): void {
    if (!postEffects.has(id)) return;
    if (id === postEffects.activeId.value && activeTab.value === 'post') return;

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

  function addUserUniform(request: {
    name: string;
    kind: UserUniformKind;
    stages?: UserUniformStage;
  }): AddUserUniformResult {
    return userDataCommands.add(request);
  }

  function removeUserUniform(id: string): UserDataCommandResult {
    return userDataCommands.remove(id);
  }

  function renameUserUniform(id: string, name: string): UserDataCommandResult {
    return userDataCommands.rename(id, name);
  }

  function changeUserUniformKind(
    id: string,
    kind: UserUniformKind,
  ): UserDataCommandResult {
    return userDataCommands.changeKind(id, kind);
  }

  function changeUserUniformStages(
    id: string,
    stages: UserUniformStage,
  ): UserDataCommandResult {
    return userDataCommands.changeStages(id, stages);
  }

  function setUserUniformValue(
    id: string,
    value: UserUniformValue,
  ): UserDataCommandResult {
    return userDataCommands.setValue(id, value);
  }

  function validateUserUniformName(name: string, exceptId?: string) {
    return userDataCommands.validateName(name, exceptId);
  }

  function resize() {
    sceneManager.resize();
  }

  function setWireframe(on: boolean) {
    wireframe.value = on;
    sceneManager.setWireframe(on);
  }

  function setPaused(on: boolean) {
    paused.value = on;
    sceneManager.setPaused(on);
  }

  onBeforeUnmount(() => {
    editorManager.dispose();
    sceneManager.dispose();
    userData.dispose();
  });

  return {
    activeTab,
    activeModelId,
    activeHdriId,
    models: previewModels.all,
    hdris: previewHdris.all,
    cursorLine,
    cursorCol,
    status,
    statusMessage,
    wireframe,
    paused,
    errors,
    userDataDoc,
    highlightedUserRow,
    loadingMessage,
    postEffects: postEffects.effects,
    activePostEffectId: postEffects.activeId,
    activePostEffect: postEffects.active,
    tonemap: postEffects.tonemap,
    mountEditor,
    mountCanvas,
    switchTab,
    loadExample,
    selectModel,
    selectHdri,
    compile,
    compilePostEffects,
    revealError,
    resize,
    setWireframe,
    setPaused,
    selectPostEffect,
    addPostEffect,
    removePostEffect,
    movePostEffect,
    setPostEffectEnabled,
    setTonemap,
    addUserUniform,
    removeUserUniform,
    renameUserUniform,
    changeUserUniformKind,
    changeUserUniformStages,
    setUserUniformValue,
    validateUserUniformName,
    clipboardSource,
  };
}
