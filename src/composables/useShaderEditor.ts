import { computed, onBeforeUnmount, reactive, ref, type Ref } from 'vue';

import { EditorManager } from '@/services/codemirror/EditorManager';
import { SceneManager } from '@/services/babylon/SceneManager';
import type { MaterialBlueprint } from '@/core/models/shaderSource';
import type { PostEffectStack, TonemapMode } from '@/core/models/postEffect';
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewModel } from '@/core/models/previewModel';
import type { UserDataDocument } from '@/core/models/userUniform';
import { createEmptyUserDataDocument } from '@/core/models/userUniform';
import { previewModels } from '@/core/constants/previewModels';
import { previewHdris } from '@/core/constants/previewHdris';
import { findShaderExample } from '@/core/constants/shaderExamples';
import { buildPostEffectSource } from '@/core/shader/postEffectCodegen';
import { GenerationTracker } from '@/core/async/generation';
import { UserDataController } from '@/services/userdata/UserDataController';
import { LoadProfiler, exposeProfiler } from '@/services/perf/LoadProfiler';
import {
  useShaderCompilation,
  type EditorStatusMessage,
} from './useShaderCompilation';
import { usePostEffects } from './usePostEffects';
import { useUserDataCommands } from './useUserDataCommands';
import {
  useEditorNavigation,
  type EditorNavigation,
} from './useEditorNavigation';

export type { EditorStatus } from './useShaderCompilation';

/**
 * Composition root of the editor screen.
 *
 * It owns the managers and wires four focused collaborators: navigation (tabs,
 * buffers, diagnostics and reveal), compilation (queue + error/status state),
 * the post-effect stack and the user-data command surface. It deliberately does
 * not implement those concerns itself.
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

  const activeModel = ref<PreviewModel>(previewModels.default);
  const activeModelId = computed(() => activeModel.value.id);
  const activeHdri = ref<PreviewHdri>(previewHdris.default);
  const activeHdriId = computed(() => activeHdri.value.id);
  const wireframe = ref(false);
  const paused = ref(false);
  /** Empty while the preview is idle; drives the canvas loading overlay. */
  const loadingMessage = ref<EditorStatusMessage | null>(null);
  let loadingDepth = 0;

  function beginLoad(message: EditorStatusMessage): void {
    loadingDepth += 1;
    loadingMessage.value = message;
  }

  function endLoad(): void {
    loadingDepth = Math.max(0, loadingDepth - 1);
    if (loadingDepth === 0) loadingMessage.value = null;
  }

  /**
   * Creates one dropdown selection command. The visible selection switches
   * immediately, but the previous *confirmed* value is remembered: a failed
   * load restores it unless a newer selection already owns the dropdown.
   */
  function createConfirmedSelection<T extends { id: string }>(options: {
    readonly active: Ref<T>;
    readonly initial: T;
    readonly find: (id: string) => T | undefined;
    readonly load: (value: T) => Promise<boolean>;
    readonly measure: string;
    readonly loadingKey: string;
  }): (id: string) => Promise<void> {
    const selection = new GenerationTracker();
    let confirmed = options.initial;

    return async (id) => {
      if (id === options.active.value.id) return;

      const next = options.find(id);
      if (!next) return;

      const request = selection.begin();
      const previous = confirmed;
      options.active.value = next;

      beginLoad({ key: options.loadingKey });
      try {
        const loaded = await loadProfiler.measure(options.measure, () =>
          options.load(next),
        );

        if (loaded) {
          confirmed = next;
          return;
        }

        if (request.isCurrent()) options.active.value = previous;
      } finally {
        endLoad();
      }
    };
  }

  const selectModel = createConfirmedSelection<PreviewModel>({
    active: activeModel,
    initial: previewModels.default,
    find: (id) => previewModels.find(id),
    load: (model) => sceneManager.loadModel(model),
    measure: 'model:swap',
    loadingKey: 'editor.loading.model',
  });

  const selectHdri = createConfirmedSelection<PreviewHdri>({
    active: activeHdri,
    initial: previewHdris.default,
    find: (id) => previewHdris.find(id),
    load: (hdri) => sceneManager.loadEnvironment(hdri),
    measure: 'env:swap',
    loadingKey: 'editor.loading.environment',
  });

  const userDataDoc: UserDataDocument = reactive(createEmptyUserDataDocument());

  /**
   * Navigation is created below, once the compilation state it reads exists.
   * The callbacks wired here only run after this composable has returned (mount
   * and edits), so they resolve the live navigation instance by closure instead
   * of forcing a creation order that would reorder observable side effects.
   *
   * The effect stack only knows how to edit itself; it asks the coordinator to
   * flush the buffer and apply the output transform.
   */
  const postEffects = usePostEffects({
    onBeforeEdit: () => navigation.storeActiveDocument(),
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
    getMaterialBlueprint: () =>
      userData.buildBlueprint(navigation.currentSources()),
    getPostStack: () => currentPostStack(),
    onBeforeCompile: () => navigation.storeActiveDocument(),
    onOutcome: (result) => navigation.applyOutcome(result),
    onExternalErrors: (errors) => navigation.applyExternalErrors(errors),
  });

  const userData = new UserDataController(
    {
      getSources: () => navigation.currentSources(),
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

  const navigation: EditorNavigation = useEditorNavigation({
    editorManager,
    userDataDoc,
    errors,
    postEffects: {
      activeId: postEffects.activeId,
      active: postEffects.active,
      has: postEffects.has,
      select: postEffects.select,
    },
    compilation: {
      setTarget: compilation.setTarget,
      setIdle: compilation.setIdle,
      setReady: compilation.setReady,
    },
  });

  function currentPostStack(): PostEffectStack {
    return {
      tonemap: postEffects.tonemap.value,
      effects: postEffects.effects
        .filter((effect) => effect.enabled)
        .map((effect) => buildPostEffectSource(userDataDoc, effect)),
    };
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
          userData.buildBlueprint(navigation.currentSources()),
          activeModel.value,
          activeHdri.value,
          userData,
          currentPostStack(),
        ),
      )
      .finally(endLoad);

    sceneManager.setPaused(false);
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

    navigation.replaceDocuments({
      vertex: example.vertex,
      fragment: example.fragment,
    });

    // The example's editable parameters live in the User data document, which
    // generates the declarations its source references and binds the seeded
    // values. Replacing the document (rather than merging) keeps a load
    // deterministic; it is part of the same destructive load as the sources.
    userDataCommands.replaceAll(example.uniforms);

    // Diagnostics belong to the previous source; `applyTab` clears them from
    // the editor and the compile below republishes them for the example.
    compilation.clearErrors();
    navigation.clearHighlightedRow();

    navigation.applyTab(
      navigation.isEditableTab(navigation.activeTab.value)
        ? navigation.activeTab.value
        : 'vertex',
    );

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

  function selectPostEffect(id: string): void {
    if (!postEffects.has(id)) return;
    if (
      id === postEffects.activeId.value &&
      navigation.activeTab.value === 'post'
    )
      return;

    postEffects.select(id);
    navigation.applyTab('post');

    compilation.setIdle({ key: 'editor.status.messages.postEffectSelected' });
  }

  function addPostEffect(): void {
    postEffects.add();
    navigation.applyTab('post');

    void compilation.compilePostEffects();
  }

  function removePostEffect(id: string): void {
    if (!postEffects.remove(id)) return;

    if (navigation.activeTab.value === 'post') navigation.applyTab('post');
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
    activeTab: navigation.activeTab,
    activeModelId,
    activeHdriId,
    models: previewModels.all,
    hdris: previewHdris.all,
    cursorLine: navigation.cursorLine,
    cursorCol: navigation.cursorCol,
    status,
    statusMessage,
    wireframe,
    paused,
    errors,
    userDataDoc,
    highlightedUserRow: navigation.highlightedUserRow,
    loadingMessage,
    postEffects: postEffects.effects,
    activePostEffectId: postEffects.activeId,
    activePostEffect: postEffects.active,
    tonemap: postEffects.tonemap,
    mountEditor: navigation.mountEditor,
    mountCanvas,
    switchTab: navigation.switchTab,
    loadExample,
    selectModel,
    selectHdri,
    compile,
    compilePostEffects,
    revealError: navigation.revealError,
    resize,
    setWireframe,
    setPaused,
    selectPostEffect,
    addPostEffect,
    removePostEffect,
    movePostEffect,
    setPostEffectEnabled,
    setTonemap,
    userDataCommands,
    clipboardSource: navigation.clipboardSource,
  };
}
