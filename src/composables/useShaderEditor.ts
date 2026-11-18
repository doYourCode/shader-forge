import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import {
  EditorManager,
  type EditorDiagnostic,
} from '@/services/codemirror/EditorManager';
import {
  SceneManager,
  type CompileResult,
  type MaterialBlueprint,
  type ShaderSource,
} from '@/services/babylon/SceneManager';
import type { EditorTabId } from '@/core/models/editorTab';
import type {
  PostEffectDocument,
  PostEffectStack,
  TonemapMode,
} from '@/core/models/postEffect';
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
import { createDefaultPostEffect } from '@/core/constants/postEffects';
import { assembleStage, generateBlock } from '@/core/shader/uniformCodegen';
import { buildPostEffectSource } from '@/core/shader/postEffectCodegen';
import {
  UserDataController,
  type AddUserUniformResult,
  type UserDataCommandResult,
} from '@/services/userdata/UserDataController';
import { LoadProfiler, exposeProfiler } from '@/services/perf/LoadProfiler';

export type EditorStatus = 'idle' | 'ready' | 'error' | 'compiling';

type EditableTabId = 'vertex' | 'fragment';
type TextTabId = 'vertex' | 'fragment' | 'uniforms' | 'io';
/** Which document family the Compile button (and structural edits) target. */
type CompileTarget = 'material' | 'post';

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
  const status = ref<EditorStatus>('idle');
  const statusMessage = ref('');
  const source = ref(defaultVertexShader);
  const wireframe = ref(false);
  const paused = ref(false);
  const errors = ref<ShaderError[]>([]);
  const highlightedUserRow = ref<number | null>(null);
  /**
   * View-space effect stack. At least one effect always exists so the post tab
   * always has a document to edit.
   */
  const postEffects = reactive<PostEffectDocument[]>([
    createDefaultPostEffect('effect-1'),
  ]);
  const activePostEffectId = ref('effect-1');
  const activePostEffect = computed<PostEffectDocument | null>(
    () =>
      postEffects.find((effect) => effect.id === activePostEffectId.value) ??
      postEffects[0] ??
      null,
  );
  const tonemap = ref<TonemapMode>('none');
  const compileTarget = ref<CompileTarget>('material');
  let effectCounter = 1;
  /** Empty while the preview is idle; drives the canvas loading overlay. */
  const loadingMessage = ref('');
  let loadingDepth = 0;

  function beginLoad(message: string): void {
    loadingDepth += 1;
    loadingMessage.value = message;
  }

  function endLoad(): void {
    loadingDepth = Math.max(0, loadingDepth - 1);
    if (loadingDepth === 0) loadingMessage.value = '';
  }

  const tabDocs: Record<TextTabId, string> = {
    vertex: defaultVertexShader,
    fragment: defaultFragmentShader,
    uniforms: defaultUniformsDoc,
    io: defaultIoDoc,
  };

  const userDataDoc: UserDataDocument = reactive(createEmptyUserDataDocument());
  const userData = new UserDataController(
    {
      getSources: () => currentSources(),
      onCompileRequested: (blueprint) => {
        // A structural edit changes declarations for one of the two document
        // families; recompiling both keeps every generated block truthful.
        void compile(blueprint).then(() => compilePostEffects());
      },
    },
    userDataDoc,
  );

  /**
   * All shader work runs one compile at a time: material and post-effect
   * compilers share the WebGL log recorder, so overlapping batches would
   * misattribute driver diagnostics.
   */
  let shaderWork: Promise<unknown> = Promise.resolve();

  function serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = shaderWork.then(work, work);
    shaderWork = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  let compileInFlight = false;
  let queuedCompile: MaterialBlueprint | 'current' | null = null;
  let confirmedModel = previewModels.default;
  let modelSelection = 0;
  let confirmedHdri = previewHdris.default;
  let hdriSelection = 0;

  sceneManager.onError = (shaderErrors) => {
    errors.value = shaderErrors;
    status.value = 'error';
    statusMessage.value = formatErrorStatus(shaderErrors);
    highlightedUserRow.value = firstUserDataRow(shaderErrors);
    editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
  };

  function currentSources(): ShaderSource {
    return { vertex: tabDocs.vertex, fragment: tabDocs.fragment };
  }

  function isEditableTab(tab: EditorTabId): tab is EditableTabId {
    return tab === 'vertex' || tab === 'fragment';
  }

  function storeActiveDocument() {
    if (activeTab.value === 'post') {
      const effect = activePostEffect.value;
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
            error.effectId === activePostEffectId.value &&
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

  function applyTab(tab: EditorTabId) {
    activeTab.value = tab;

    if (tab === 'post') {
      compileTarget.value = 'post';
      editorManager.setValue(activePostEffect.value?.fragment ?? '');
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

    compileTarget.value = 'material';

    const readOnly = !isEditableTab(tab);
    editorManager.setValue(tabDocs[tab]);
    editorManager.setReadOnly(readOnly);
    editorManager.setDiagnostics(diagnosticsFor(tab));
    editorManager.setInjectedBlock(injectedBlockFor(tab));

    if (!readOnly) {
      source.value = tabDocs[tab];
    }
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
      const effect = activePostEffect.value;
      return effect ? buildPostEffectSource(userDataDoc, effect).fragment : '';
    }

    if (!isEditableTab(tab)) return tabDocs[tab];

    return assembleStage(tabDocs[tab], generateBlock(userDataDoc, tab)).source;
  }

  // Definitions and values change the generated declarations and the values
  // comment; the preview follows them immediately.
  watch(() => userDataDoc.revision, updateInjectedBlock);

  function mountEditor(host: HTMLElement) {
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

    status.value = 'ready';
    statusMessage.value = 'Editor ready';
  }

  function currentPostStack(): PostEffectStack {
    return {
      tonemap: tonemap.value,
      effects: postEffects
        .filter((effect) => effect.enabled)
        .map((effect) => buildPostEffectSource(userDataDoc, effect)),
    };
  }

  function mountCanvas(canvas: HTMLCanvasElement) {
    beginLoad('Loading preview…');

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

    beginLoad('Loading model…');
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

    beginLoad('Loading environment…');
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

  function switchTab(tab: EditorTabId) {
    if (tab === activeTab.value) return;

    storeActiveDocument();
    applyTab(tab);

    status.value = 'idle';
    statusMessage.value = `Switched to ${tab}`;
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
    userData.replaceAll(example.uniforms);

    // Diagnostics belong to the previous source; `applyTab` clears them from
    // the editor and the compile below republishes them for the example.
    errors.value = [];
    highlightedUserRow.value = null;

    applyTab(isEditableTab(activeTab.value) ? activeTab.value : 'vertex');

    void compile().then(() => {
      if (status.value === 'ready') {
        statusMessage.value = `Loaded example: ${example.label}`;
      }
    });
  }

  async function compile(blueprint?: MaterialBlueprint) {
    // The Compile button acts on the document family being edited. Structural
    // user-data edits pass a blueprint, so they always compile the material.
    if (blueprint === undefined && compileTarget.value === 'post') {
      await compilePostEffects();
      return;
    }

    // A structural edit may land while a compile is in flight; the latest
    // request is replayed after the current one settles.
    if (compileInFlight) {
      queuedCompile = blueprint ?? 'current';
      return;
    }

    compileInFlight = true;
    storeActiveDocument();

    const target = blueprint ?? userData.buildBlueprint(currentSources());

    status.value = 'compiling';
    statusMessage.value = 'Compiling…';

    let result: CompileResult;
    try {
      result = await serialize(() => sceneManager.compile(target));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        ok: false,
        message,
        errors: [
          {
            stage: 'program',
            line: null,
            column: null,
            kind: 'internal',
            title: 'Shader compilation failed',
            message,
            advice: null,
          },
        ],
      };
    } finally {
      compileInFlight = false;
    }

    applyCompileResult(result);

    const next = queuedCompile;
    queuedCompile = null;
    if (next !== null) {
      void compile(next === 'current' ? undefined : next);
    }
  }

  function applyCompileResult(result: CompileResult): void {
    errors.value = result.errors;
    highlightedUserRow.value = firstUserDataRow(result.errors);

    if (result.ok) {
      status.value = 'ready';
      statusMessage.value = 'Compiled successfully';
      editorManager.setDiagnostics(diagnosticsFor(activeTab.value));
      return;
    }

    status.value = 'error';
    statusMessage.value =
      result.errors.length > 0
        ? formatErrorStatus(result.errors)
        : result.message;

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
    if (effectId && postEffects.some((effect) => effect.id === effectId)) {
      activePostEffectId.value = effectId;
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
    if (!postEffects.some((effect) => effect.id === id)) return;
    if (id === activePostEffectId.value && activeTab.value === 'post') return;

    storeActiveDocument();
    activePostEffectId.value = id;
    applyTab('post');

    status.value = 'idle';
    statusMessage.value = 'Post effect selected';
  }

  function addPostEffect(): void {
    storeActiveDocument();

    effectCounter += 1;
    const effect = createDefaultPostEffect(
      `effect-${effectCounter}`,
      `Effect ${effectCounter}`,
    );

    postEffects.push(effect);
    activePostEffectId.value = effect.id;
    applyTab('post');

    void compilePostEffects();
  }

  function removePostEffect(id: string): void {
    const index = postEffects.findIndex((effect) => effect.id === id);
    if (index < 0) return;

    storeActiveDocument();
    postEffects.splice(index, 1);

    // The post tab always needs a document to edit.
    if (postEffects.length === 0) {
      effectCounter += 1;
      postEffects.push(
        createDefaultPostEffect(
          `effect-${effectCounter}`,
          `Effect ${effectCounter}`,
        ),
      );
    }

    if (activePostEffectId.value === id) {
      const next = postEffects[Math.min(index, postEffects.length - 1)];
      if (next) activePostEffectId.value = next.id;
    }

    if (activeTab.value === 'post') applyTab('post');
    void compilePostEffects();
  }

  function movePostEffect(id: string, offset: number): void {
    const index = postEffects.findIndex((effect) => effect.id === id);
    if (index < 0) return;

    const target = index + offset;
    if (target < 0 || target >= postEffects.length) return;

    const [effect] = postEffects.splice(index, 1);
    if (!effect) return;

    postEffects.splice(target, 0, effect);
    void compilePostEffects();
  }

  function setPostEffectEnabled(id: string, enabled: boolean): void {
    const effect = postEffects.find((candidate) => candidate.id === id);
    if (!effect || effect.enabled === enabled) return;

    effect.enabled = enabled;
    void compilePostEffects();
  }

  function setTonemap(mode: TonemapMode): void {
    tonemap.value = mode;
    sceneManager.setTonemap(mode);
  }

  let postCompileInFlight = false;
  let postCompileQueued = false;

  /**
   * Compiles the enabled effect stack. The chain is replaced only as a whole,
   * so a failing effect keeps the last working stack on screen.
   */
  async function compilePostEffects(): Promise<void> {
    if (postCompileInFlight) {
      postCompileQueued = true;
      return;
    }

    postCompileInFlight = true;
    storeActiveDocument();

    status.value = 'compiling';
    statusMessage.value = 'Compiling post effects…';

    let result: CompileResult;
    try {
      result = await serialize(() =>
        sceneManager.compilePostEffects(currentPostStack()),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        ok: false,
        message,
        errors: [
          {
            stage: 'post',
            line: null,
            column: null,
            kind: 'internal',
            title: 'Post effect compilation failed',
            message,
            advice: null,
          },
        ],
      };
    } finally {
      postCompileInFlight = false;
    }

    applyCompileResult(result);

    if (postCompileQueued) {
      postCompileQueued = false;
      void compilePostEffects();
    }
  }

  function addUserUniform(request: {
    name: string;
    kind: UserUniformKind;
    stages?: UserUniformStage;
  }): AddUserUniformResult {
    return userData.add(request);
  }

  function removeUserUniform(id: string): UserDataCommandResult {
    return userData.remove(id);
  }

  function renameUserUniform(id: string, name: string): UserDataCommandResult {
    return userData.rename(id, name);
  }

  function changeUserUniformKind(
    id: string,
    kind: UserUniformKind,
  ): UserDataCommandResult {
    return userData.changeKind(id, kind);
  }

  function changeUserUniformStages(
    id: string,
    stages: UserUniformStage,
  ): UserDataCommandResult {
    return userData.changeStages(id, stages);
  }

  function setUserUniformValue(
    id: string,
    value: UserUniformValue,
  ): UserDataCommandResult {
    return userData.setValue(id, value);
  }

  function validateUserUniformName(name: string, exceptId?: string) {
    return userData.validateName(name, exceptId);
  }

  function formatErrorStatus(shaderErrors: readonly ShaderError[]): string {
    const first = shaderErrors.find((error) => error.line !== null);
    const suffix = first?.line != null ? ` · line ${first.line}` : '';
    return `${shaderErrors.length} shader ${
      shaderErrors.length === 1 ? 'error' : 'errors'
    }${suffix}`;
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
    source,
    wireframe,
    paused,
    errors,
    userDataDoc,
    highlightedUserRow,
    loadingMessage,
    postEffects,
    activePostEffectId,
    activePostEffect,
    tonemap,
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
