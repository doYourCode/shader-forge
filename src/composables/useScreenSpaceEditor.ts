import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import type { BaseTexture } from '@babylonjs/core';

import { USER_UNIFORM_KINDS } from '@/core/constants/userUniformKinds';
import { previewHdris } from '@/core/constants/previewHdris';
import { previewScenes } from '@/core/constants/previewScenes';
import { SCREEN_SPACE_RESERVED_NAMES } from '@/core/constants/screenSpaceAbi';
import {
  DEFAULT_ENVIRONMENT_INTENSITY,
  DEFAULT_SUN_INTENSITY,
} from '@/core/constants/screenSpaceRender';
import { createScreenSpaceEffect } from '@/core/constants/screenSpaceEffects';
import type { GbufferDebugMode } from '@/core/constants/screenSpaceDebug';
import type { PostEffectStack, TonemapMode } from '@/core/models/postEffect';
import type { PreviewHdri } from '@/core/models/previewHdri';
import type { PreviewScene } from '@/core/models/previewScene';
import type { MaterialBlueprint } from '@/core/models/shaderSource';
import { createEmptyUserDataDocument } from '@/core/models/userUniform';
import { buildPostEffectSource } from '@/core/shader/postEffectCodegen';
import { EditorManager } from '@/services/codemirror/EditorManager';
import {
  ScreenSpaceSceneManager,
  type ScreenSpaceFrameStats,
} from '@/services/babylon/screenspace/ScreenSpaceSceneManager';
import { UserDataController } from '@/services/userdata/UserDataController';
import type { UserDataCommands } from './useUserDataCommands';
import { usePostEffects } from './usePostEffects';
import {
  usePostEffectNavigation,
  type PostEffectNavigation,
  type ScreenSpaceTab,
} from './usePostEffectNavigation';
import { useScreenSpaceCompilation } from './useScreenSpaceCompilation';
import { useUserDataCommands } from './useUserDataCommands';

export interface UseScreenSpaceEditorOptions {
  readonly initialTab?: ScreenSpaceTab;
}

const EMPTY_BLUEPRINT: MaterialBlueprint = {
  vertex: '',
  fragment: '',
  editorSource: { vertex: '', fragment: '' },
  extraUniforms: [],
  extraSamplers: [],
};

/**
 * Composition root for the Screen Space GLSL Editor.
 *
 * It owns the whole-scene renderer, the effect stack, the post-only user-data
 * document and the editor navigation. It shares the compile queue and the
 * reusable UI pieces with the surface editor, but never creates a surface
 * material, vertex/fragment document or mesh shader.
 */
export function useScreenSpaceEditor(
  options: UseScreenSpaceEditorOptions = {},
) {
  const editorManager = new EditorManager();
  const sceneManager = new ScreenSpaceSceneManager();

  const activeScene = ref<PreviewScene>(previewScenes.default);
  const activeHdri = ref<PreviewHdri>(previewHdris.default);
  const activeSceneId = computed(() => activeScene.value.id);
  const activeHdriId = computed(() => activeHdri.value.id);
  const paused = ref(false);
  const loadingMessage = ref<{
    key: string;
    params?: Record<string, unknown>;
  } | null>(null);
  const stats = ref<ScreenSpaceFrameStats | null>(null);
  const debugMode = ref<GbufferDebugMode>('off');
  const sunIntensity = ref(DEFAULT_SUN_INTENSITY);
  const environmentIntensity = ref(DEFAULT_ENVIRONMENT_INTENSITY);

  let navigation: PostEffectNavigation | null = null;

  const postEffects = usePostEffects({
    onBeforeEdit: () => navigation?.storeActiveDocument(),
    applyTonemap: (mode: TonemapMode) => sceneManager.setTonemap(mode),
    createEffect: (id, name) =>
      createScreenSpaceEffect(id, name ?? 'Passthrough'),
  });

  // The scene is authored in HDR; ACES is the sane default for a scene view.
  postEffects.setTonemap('aces');

  const userDataDoc = reactive(createEmptyUserDataDocument());

  function currentPostStack(): PostEffectStack {
    return {
      tonemap: postEffects.tonemap.value,
      effects: postEffects.effects
        .filter((effect) => effect.enabled)
        .map((effect) => buildPostEffectSource(userDataDoc, effect)),
    };
  }

  const compilation = useScreenSpaceCompilation({
    compilePostEffects: (stack) => sceneManager.compilePostEffects(stack),
    getPostStack: currentPostStack,
    onBeforeCompile: () => navigation?.storeActiveDocument(),
    onOutcome: (result) => navigation?.applyOutcome(result),
    onExternalErrors: (errors) => navigation?.applyExternalErrors(errors),
  });

  const userData = new UserDataController<BaseTexture>(
    {
      getSources: () => ({ vertex: '', fragment: '' }),
      onCompileRequested: () => {
        void compilation.compilePostEffects();
      },
      buildBlueprint: () => EMPTY_BLUEPRINT,
      reservedNames: SCREEN_SPACE_RESERVED_NAMES,
    },
    userDataDoc,
  );

  const userDataCommands: UserDataCommands = {
    ...useUserDataCommands(userData),
    // The panel's add form has no stage picker; this editor only authors
    // post-stage uniforms.
    add: (request) => userData.add({ ...request, stages: 'post' }),
  };

  navigation = usePostEffectNavigation({
    editorManager,
    userDataDoc,
    errors: compilation.errors,
    effects: {
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
    initialTab: options.initialTab,
  });

  sceneManager.onError = (errors) => compilation.reportErrors(errors);
  let lastStatsAt = 0;
  sceneManager.onStats = (next) => {
    const now = performance.now();
    if (now - lastStatsAt < 250) return;
    lastStatsAt = now;
    stats.value = next;
  };
  sceneManager.onLoading = (message) => {
    loadingMessage.value = message;
  };

  function mountEditor(host: HTMLElement): void {
    navigation?.mountEditor(host);
  }

  function mountCanvas(canvas: HTMLCanvasElement): void {
    loadingMessage.value = { key: 'editor.loading.preview' };

    void sceneManager
      .init(
        canvas,
        activeScene.value,
        activeHdri.value,
        currentPostStack(),
        userData,
      )
      .finally(() => {
        loadingMessage.value = null;
      });

    sceneManager.setPaused(false);
  }

  async function compile(): Promise<void> {
    await compilation.compilePostEffects();
    if (compilation.status.value === 'ready') {
      userData.commitTextureReleases();
    }
  }

  async function selectScene(id: string): Promise<void> {
    if (id === activeScene.value.id) return;

    const next = previewScenes.find(id);
    if (!next) return;

    const previous = activeScene.value;
    activeScene.value = next;
    loadingMessage.value = { key: 'screenSpace.loading.scene' };

    try {
      const loaded = await sceneManager.loadScene(next);
      if (!loaded) activeScene.value = previous;
    } finally {
      loadingMessage.value = null;
    }
  }

  async function selectHdri(id: string): Promise<void> {
    if (id === activeHdri.value.id) return;

    const next = previewHdris.find(id);
    if (!next) return;

    const previous = activeHdri.value;
    activeHdri.value = next;
    loadingMessage.value = { key: 'editor.loading.environment' };

    try {
      const loaded = await sceneManager.loadEnvironment(next);
      if (!loaded) activeHdri.value = previous;
    } finally {
      loadingMessage.value = null;
    }
  }

  function selectPostEffect(id: string): void {
    if (!postEffects.has(id)) return;
    if (
      id === postEffects.activeId.value &&
      navigation?.activeTab.value === 'post'
    ) {
      return;
    }

    postEffects.select(id);
    navigation?.applyTab('post');
    compilation.setIdle({ key: 'editor.status.messages.postEffectSelected' });
  }

  function addPostEffect(): void {
    postEffects.add();
    navigation?.applyTab('post');
    void compile();
  }

  function removePostEffect(id: string): void {
    if (!postEffects.remove(id)) return;
    if (navigation?.activeTab.value === 'post') navigation.applyTab('post');
    void compile();
  }

  function movePostEffect(id: string, offset: number): void {
    if (postEffects.move(id, offset)) void compile();
  }

  function setPostEffectEnabled(id: string, enabled: boolean): void {
    if (postEffects.setEnabled(id, enabled)) void compile();
  }

  function setTonemap(mode: TonemapMode): void {
    postEffects.setTonemap(mode);
  }

  function setDebugMode(mode: GbufferDebugMode): void {
    debugMode.value = mode;
    sceneManager.setDebugMode(mode);
  }

  function setSunIntensity(value: number): void {
    sunIntensity.value = value;
    sceneManager.setSunIntensity(value);
  }

  function setEnvironmentIntensity(value: number): void {
    environmentIntensity.value = value;
    sceneManager.setEnvironmentIntensity(value);
  }

  function setPaused(value: boolean): void {
    paused.value = value;
    sceneManager.setPaused(value);
  }

  function resize(): void {
    sceneManager.resize();
  }

  const userDataKinds = USER_UNIFORM_KINDS.filter(
    (meta) => meta.kind !== 'samplerCube',
  ).map((meta) => meta.kind);

  onBeforeUnmount(() => {
    editorManager.dispose();
    sceneManager.dispose();
    userData.dispose();
  });

  return {
    activeTab: navigation.activeTab,
    activeSceneId,
    activeHdriId,
    scenes: previewScenes.all,
    hdris: previewHdris.all,
    cursorLine: navigation.cursorLine,
    cursorCol: navigation.cursorCol,
    status: compilation.status,
    statusMessage: compilation.statusMessage,
    errors: compilation.errors,
    userDataDoc,
    highlightedUserRow: navigation.highlightedUserRow,
    loadingMessage,
    stats,
    debugMode,
    sunIntensity,
    environmentIntensity,
    postEffects: postEffects.effects,
    activePostEffectId: postEffects.activeId,
    tonemap: postEffects.tonemap,
    paused,
    userDataKinds,
    mountEditor,
    mountCanvas,
    switchTab: navigation.switchTab,
    compile,
    selectScene,
    selectHdri,
    resize,
    setPaused,
    selectPostEffect,
    addPostEffect,
    removePostEffect,
    movePostEffect,
    setPostEffectEnabled,
    setTonemap,
    setDebugMode,
    setSunIntensity,
    setEnvironmentIntensity,
    revealError: navigation.revealError,
    userDataCommands,
    clipboardSource: navigation.clipboardSource,
  };
}
