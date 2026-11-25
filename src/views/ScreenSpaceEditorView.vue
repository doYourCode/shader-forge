<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { AssetPickerTexturePicker } from '@/services/assetpicker/AssetPickerTexturePicker';
import { toAssetPickerLanguage } from '@/services/assetpicker/assetPickerConfig';
import { TEXTURE_PICKER } from '@/components/shader/texturePickerContext';
import { useScreenSpaceEditor } from '@/composables/useScreenSpaceEditor';
import type { ShaderError } from '@/core/models/shaderError';
import ScreenSpaceToolbar from '@/components/screenspace/ScreenSpaceToolbar.vue';
import GbufferPanel from '@/components/screenspace/GbufferPanel.vue';
import GbufferOverlay from '@/components/screenspace/GbufferOverlay.vue';
import LightingOverlay from '@/components/screenspace/LightingOverlay.vue';
import PostEffectPanel from '@/components/shader/PostEffectPanel.vue';
import UserDataPanel from '@/components/shader/UserDataPanel.vue';
import CopyShaderButton from '@/components/shader/CopyShaderButton.vue';
import StatusBar from '@/components/shader/StatusBar.vue';

const { t, locale } = useI18n();

const editorHostRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasWrapRef = ref<HTMLElement | null>(null);

let resizeObserver: ResizeObserver | null = null;

const texturePicker = new AssetPickerTexturePicker({
  labels: () => ({
    title: t('userData.texture.dialog'),
    storage: t('userData.texture.bundled'),
  }),
  language: () => toAssetPickerLanguage(locale.value),
});
provide(TEXTURE_PICKER, texturePicker);

const {
  activeTab,
  activeSceneId,
  activeHdriId,
  scenes,
  hdris,
  cursorLine,
  cursorCol,
  status,
  statusMessage,
  errors,
  userDataDoc,
  highlightedUserRow,
  loadingMessage,
  stats,
  debugMode,
  sunIntensity,
  environmentIntensity,
  postEffects,
  activePostEffectId,
  tonemap,
  paused,
  userDataKinds,
  mountEditor,
  mountCanvas,
  switchTab,
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
  revealError,
  userDataCommands,
  clipboardSource,
} = useScreenSpaceEditor({ initialTab: 'post' });

const statusText = computed(() => {
  const message = statusMessage.value;
  return message ? t(message.key, message.params ?? {}) : '';
});

const loadingText = computed(() => {
  const message = loadingMessage.value;
  return message ? t(message.key, message.params ?? {}) : '';
});

const statsText = computed(() => {
  const value = stats.value;
  if (!value) return '';

  return t('screenSpace.stats', {
    fps: Math.round(value.fps),
    ms: value.frameMs.toFixed(1),
    budget: value.budgetMs.toFixed(1),
    width: value.width,
    height: value.height,
    drawCalls: value.drawCalls,
    scale: Math.round(value.renderScale * 100),
  });
});

const revealable = (error: ShaderError): boolean =>
  error.stage === 'post' && error.line !== null;

function onResize(): void {
  resize();
}

function togglePause(): void {
  setPaused(!paused.value);
}

onMounted(() => {
  if (editorHostRef.value) mountEditor(editorHostRef.value);
  if (canvasRef.value) mountCanvas(canvasRef.value);

  if (canvasWrapRef.value) {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(canvasWrapRef.value);
  }
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  resizeObserver?.disconnect();
  texturePicker.dispose();
});
</script>

<template>
  <div class="screen-space">
    <ScreenSpaceToolbar
      class="screen-space__toolbar"
      :active-tab="activeTab"
      :scenes="scenes"
      :active-scene-id="activeSceneId"
      :hdris="hdris"
      :active-hdri-id="activeHdriId"
      :paused="paused"
      @switch="switchTab"
      @compile="compile"
      @select-scene="selectScene"
      @select-hdri="selectHdri"
      @toggle-pause="togglePause"
    />

    <div class="screen-space__left">
      <PostEffectPanel
        v-if="activeTab === 'post'"
        class="screen-space__effects"
        :effects="postEffects"
        :active-id="activePostEffectId"
        :tonemap="tonemap"
        title-key="screenSpace.effects.title"
        description-key="screenSpace.effects.description"
        @select="selectPostEffect"
        @add="addPostEffect"
        @remove="removePostEffect"
        @move="movePostEffect"
        @toggle="setPostEffectEnabled"
        @tonemap="setTonemap"
      />

      <div
        v-show="activeTab === 'post'"
        ref="editorHostRef"
        class="screen-space__editor"
      >
        <CopyShaderButton :get-text="clipboardSource" />
      </div>

      <UserDataPanel
        v-if="activeTab === 'user_data'"
        class="screen-space__user-data"
        :definitions="userDataDoc.definitions"
        :highlighted-row="highlightedUserRow"
        :validate-name="userDataCommands.validateName"
        :stages="['post']"
        :kinds="userDataKinds"
        :preview-stages="['post']"
        @add="userDataCommands.add"
        @remove="userDataCommands.remove"
        @rename="userDataCommands.rename"
        @change-kind="userDataCommands.changeKind"
        @change-stages="userDataCommands.changeStages"
        @change-value="userDataCommands.setValue"
      />

      <GbufferPanel
        v-if="activeTab === 'gbuffer'"
        class="screen-space__gbuffer"
        :active="debugMode"
        @change="setDebugMode"
      />
    </div>

    <div class="screen-space__right">
      <div ref="canvasWrapRef" class="screen-space__canvas-wrap">
        <canvas ref="canvasRef" class="screen-space__canvas" />

        <GbufferOverlay :active="debugMode" @change="setDebugMode" />

        <LightingOverlay
          :sun-intensity="sunIntensity"
          :environment-intensity="environmentIntensity"
          @sun-intensity="setSunIntensity"
          @environment-intensity="setEnvironmentIntensity"
        />

        <p class="screen-space__hint">{{ t('screenSpace.fpsHint') }}</p>

        <p v-if="statsText" class="screen-space__stats">{{ statsText }}</p>

        <div
          v-if="loadingText"
          class="screen-space__loading"
          role="status"
          aria-live="polite"
        >
          <span class="screen-space__spinner" aria-hidden="true" />
          <span>{{ loadingText }}</span>
        </div>

        <div
          v-if="errors.length"
          class="screen-space__errors"
          role="alert"
          aria-live="assertive"
        >
          <div class="screen-space__errors-header">
            <span class="screen-space__errors-title">
              {{ t('editor.error.title') }}
            </span>
            <span class="screen-space__errors-count">
              {{ t('editor.error.count', { count: errors.length }) }}
            </span>
          </div>
          <ul class="screen-space__errors-list">
            <li v-for="(error, index) in errors" :key="index">
              <button
                type="button"
                class="screen-space__error"
                :disabled="!revealable(error)"
                @click="revealError(error)"
              >
                <span class="screen-space__error-head">
                  <span
                    class="screen-space__error-kind"
                    :data-kind="error.kind"
                  >
                    {{ t(`editor.error.kind.${error.kind}`) }}
                  </span>
                  <span class="screen-space__error-stage">
                    {{ t(`editor.stage.${error.stage}`) }}
                  </span>
                </span>
                <span class="screen-space__error-title">{{ error.title }}</span>
                <code class="screen-space__error-message">{{
                  error.message
                }}</code>
                <span v-if="error.advice" class="screen-space__error-advice">
                  {{ error.advice }}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <StatusBar
      class="screen-space__status"
      :line="cursorLine"
      :col="cursorCol"
      :status="status"
      :message="statusText"
    />
  </div>
</template>

<style scoped>
.screen-space {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto 1fr auto;
  height: 100%;
  min-height: 0;
}

.screen-space__toolbar {
  grid-column: 1 / -1;
}

.screen-space__left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--border-subtle);
}

.screen-space__effects,
.screen-space__editor,
.screen-space__user-data,
.screen-space__gbuffer {
  border-bottom: 1px solid var(--border-subtle);
}

.screen-space__effects {
  flex: 0 0 auto;
  max-height: 45%;
  overflow: auto;
}

.screen-space__editor {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.screen-space__editor :deep(.cm-editor) {
  height: 100%;
}

.screen-space__editor :deep(.cm-scroller) {
  overflow: auto;
}

.screen-space__user-data,
.screen-space__gbuffer {
  flex: 1;
  min-height: 0;
}

.screen-space__right {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.screen-space__canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.screen-space__canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
  cursor: crosshair;
}

.screen-space__hint {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 2;
  margin: 0;
  padding: 4px 7px;
  background: rgba(33, 37, 43, 0.82);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 10px;
  pointer-events: none;
}

.screen-space__stats {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  margin: 0;
  padding: 4px 7px;
  background: rgba(33, 37, 43, 0.82);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  pointer-events: none;
}

.screen-space__loading {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(33, 37, 43, 0.72);
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  pointer-events: none;
}

.screen-space__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--accent-ui);
  border-radius: 50%;
  animation: screen-space-spin 0.8s linear infinite;
}

@keyframes screen-space-spin {
  to {
    transform: rotate(360deg);
  }
}

.screen-space__errors {
  position: absolute;
  left: 12px;
  right: 12px;
  top: 46px;
  z-index: 4;
  max-height: 45%;
  overflow: auto;
  padding: 10px 12px;
  background: rgba(33, 37, 43, 0.96);
  border: 1px solid var(--accent-red);
  border-radius: 4px;
  box-shadow: 0 8px 24px var(--shadow);
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
}

.screen-space__errors-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.screen-space__errors-title {
  color: var(--accent-red);
  font-weight: 700;
}

.screen-space__errors-count {
  color: var(--fg-muted);
  font-size: 11px;
}

.screen-space__errors-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.screen-space__error {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.screen-space__error:hover:not(:disabled) {
  background: rgba(224, 108, 117, 0.14);
  border-color: rgba(224, 108, 117, 0.5);
}

.screen-space__error-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.screen-space__error-kind {
  padding: 1px 5px;
  background: rgba(224, 108, 117, 0.14);
  border: 1px solid rgba(224, 108, 117, 0.45);
  border-radius: 3px;
  color: var(--accent-red);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.screen-space__error-stage {
  color: var(--fg-muted);
  font-size: 11px;
}

.screen-space__error-title {
  color: var(--fg-strong);
  font-weight: 600;
}

.screen-space__error-message {
  color: var(--fg);
  font-family: var(--font-code);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
}

.screen-space__error-advice {
  color: var(--fg-muted);
  font-size: 10px;
}

.screen-space__status {
  grid-column: 1 / -1;
}
</style>
