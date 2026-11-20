<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, provide } from 'vue';
import { useI18n } from 'vue-i18n';

import { AssetPickerTexturePicker } from '@/services/assetpicker/AssetPickerTexturePicker';
import { AssetPickerExamplePicker } from '@/services/assetpicker/AssetPickerExamplePicker';
import { toAssetPickerLanguage } from '@/services/assetpicker/assetPickerConfig';
import { TEXTURE_PICKER } from '@/components/shader/texturePickerContext';
import { EXAMPLE_PICKER } from '@/components/shader/examplePickerContext';
import { useShaderEditor } from '@/composables/useShaderEditor';
import {
  dataTabGroup,
  postTab,
  stageTabGroup,
  type EditorTab,
  type EditorTabGroup,
} from '@/core/models/editorTab';
import type { ShaderError } from '@/core/models/shaderError';
import type {
  UserUniformKind,
  UserUniformStage,
  UserUniformValue,
} from '@/core/models/userUniform';
import CompileButton from '@/components/shader/CompileButton.vue';
import EditorToolbar from '@/components/shader/EditorToolbar.vue';
import ViewerToolbar from '@/components/shader/ViewerToolbar.vue';
import ViewerScenePanel from '@/components/shader/ViewerScenePanel.vue';
import AppBrand from '@/components/layout/AppBrand.vue';
import LanguageSwitch from '@/components/layout/LanguageSwitch.vue';
import StatusBar from '@/components/shader/StatusBar.vue';
import UserDataPanel from '@/components/shader/UserDataPanel.vue';
import PostEffectPanel from '@/components/shader/PostEffectPanel.vue';
import CopyShaderButton from '@/components/shader/CopyShaderButton.vue';

const { t, locale } = useI18n();

const editorHostRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasWrapRef = ref<HTMLElement | null>(null);

let canvasResizeObserver: ResizeObserver | null = null;

/**
 * One picker instance for the view's lifetime: it lazily imports AssetPicker
 * and owns every mounted picker session. Widgets receive it through injection.
 */
const texturePicker = new AssetPickerTexturePicker({
  labels: () => ({
    title: t('userData.texture.dialog'),
    storage: t('userData.texture.bundled'),
  }),
  language: () => toAssetPickerLanguage(locale.value),
});
provide(TEXTURE_PICKER, texturePicker);

/**
 * One example picker for the view's lifetime: it lazily imports the same
 * AssetPicker module and owns every mounted session. The toolbar receives it
 * through injection.
 */
const examplePicker = new AssetPickerExamplePicker({
  labels: () => ({
    title: t('editor.examples.dialog'),
    storage: t('editor.examples.bundled'),
  }),
  language: () => toAssetPickerLanguage(locale.value),
});
provide(EXAMPLE_PICKER, examplePicker);

/** The documents that stand on their own; the rest live in dropdown groups. */
const editorTabs: readonly EditorTab[] = [postTab];

/** Presentation order: shader stages, then shader data. */
const editorGroups: readonly EditorTabGroup[] = [stageTabGroup, dataTabGroup];

const {
  activeTab,
  activeModelId,
  activeHdriId,
  models,
  hdris,
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
  postEffects,
  activePostEffectId,
  tonemap,
  mountEditor,
  mountCanvas,
  switchTab,
  loadExample,
  selectModel,
  selectHdri,
  compile,
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
} = useShaderEditor();

const statusText = computed(() => {
  const message = statusMessage.value;
  return message ? t(message.key, message.params ?? {}) : '';
});

const loadingText = computed(() => {
  const message = loadingMessage.value;
  return message ? t(message.key, message.params ?? {}) : '';
});

function errorStageLabel(error: ShaderError): string {
  const stage = t(`editor.stage.${error.stage}`);

  if (error.stage === 'user_data') {
    return error.row == null
      ? stage
      : t('editor.error.atRow', { stage, row: error.row + 1 });
  }

  if (error.line === null) return stage;

  return error.column === null
    ? t('editor.error.atLine', { stage, line: error.line })
    : t('editor.error.atLineColumn', {
        stage,
        line: error.line,
        column: error.column,
      });
}

function errorKindLabel(error: ShaderError): string {
  return t(`editor.error.kind.${error.kind}`);
}

function isRevealable(error: ShaderError): boolean {
  if (error.stage === 'user_data') return error.row != null;
  if (error.stage === 'post') return error.line !== null;
  return error.stage !== 'program' && error.line !== null;
}

function handleAddUniform(request: {
  name: string;
  kind: UserUniformKind;
}): void {
  addUserUniform(request);
}

function handleRemoveUniform(id: string): void {
  removeUserUniform(id);
}

function handleRenameUniform(id: string, name: string): void {
  renameUserUniform(id, name);
}

function handleKindChange(id: string, kind: UserUniformKind): void {
  changeUserUniformKind(id, kind);
}

function handleStagesChange(id: string, stages: UserUniformStage): void {
  changeUserUniformStages(id, stages);
}

function handleValueChange(id: string, value: UserUniformValue): void {
  setUserUniformValue(id, value);
}

function handleResize() {
  resize();
}

onMounted(() => {
  if (editorHostRef.value) {
    mountEditor(editorHostRef.value);
  }
  if (canvasRef.value) {
    mountCanvas(canvasRef.value);
  }
  // The canvas box can change without a window resize (the viewer toolbar and
  // the overlay controls reflow at narrow pane widths), and the engine only
  // resizes on demand.
  if (canvasWrapRef.value) {
    canvasResizeObserver = new ResizeObserver(handleResize);
    canvasResizeObserver.observe(canvasWrapRef.value);
  }
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  canvasResizeObserver?.disconnect();
  texturePicker.dispose();
  examplePicker.dispose();
});

function toggleWireframe() {
  setWireframe(!wireframe.value);
}

function togglePause() {
  setPaused(!paused.value);
}
</script>

<template>
  <div class="shader-editor">
    <div class="shader-editor__left">
      <EditorToolbar
        :groups="editorGroups"
        :tabs="editorTabs"
        :active="activeTab"
        @switch="switchTab"
        @load-example="loadExample"
      >
        <template #brand>
          <AppBrand />
        </template>
      </EditorToolbar>
      <PostEffectPanel
        v-if="activeTab === 'post'"
        class="shader-editor__post-panel"
        :effects="postEffects"
        :active-id="activePostEffectId"
        :tonemap="tonemap"
        @select="selectPostEffect"
        @add="addPostEffect"
        @remove="removePostEffect"
        @move="movePostEffect"
        @toggle="setPostEffectEnabled"
        @tonemap="setTonemap"
      />
      <div
        v-show="activeTab !== 'user_data'"
        ref="editorHostRef"
        class="shader-editor__editor-host"
      >
        <CopyShaderButton :get-text="clipboardSource" />
      </div>
      <UserDataPanel
        v-if="activeTab === 'user_data'"
        class="shader-editor__user-data"
        :definitions="userDataDoc.definitions"
        :highlighted-row="highlightedUserRow"
        :validate-name="validateUserUniformName"
        @add="handleAddUniform"
        @remove="handleRemoveUniform"
        @rename="handleRenameUniform"
        @change-kind="handleKindChange"
        @change-stages="handleStagesChange"
        @change-value="handleValueChange"
      />
    </div>

    <div class="shader-editor__right">
      <ViewerToolbar
        :wireframe="wireframe"
        :paused="paused"
        @toggle-wireframe="toggleWireframe"
        @toggle-pause="togglePause"
      >
        <template #lead>
          <CompileButton @compile="compile" />
        </template>

        <template #trailing>
          <LanguageSwitch />
        </template>
      </ViewerToolbar>
      <div ref="canvasWrapRef" class="shader-editor__canvas-wrap">
        <canvas ref="canvasRef" class="shader-editor__canvas" />

        <ViewerScenePanel
          :models="models"
          :active-model-id="activeModelId"
          :hdris="hdris"
          :active-hdri-id="activeHdriId"
          @select-model="selectModel"
          @select-hdri="selectHdri"
        />

        <div
          v-if="loadingText"
          class="shader-editor__loading"
          role="status"
          aria-live="polite"
        >
          <span class="shader-editor__loading-spinner" aria-hidden="true" />
          <span>{{ loadingText }}</span>
        </div>

        <div
          v-if="errors.length"
          class="shader-editor__errors"
          role="alert"
          aria-live="assertive"
        >
          <div class="shader-editor__errors-header">
            <span class="shader-editor__errors-title">
              {{ t('editor.error.title') }}
            </span>
            <span class="shader-editor__errors-count">
              {{ t('editor.error.count', { count: errors.length }) }}
            </span>
          </div>
          <ul class="shader-editor__errors-list">
            <li
              v-for="(error, index) in errors"
              :key="`${error.stage}-${error.line}-${error.column}-${index}`"
            >
              <button
                type="button"
                class="shader-editor__error"
                :disabled="!isRevealable(error)"
                @click="revealError(error)"
              >
                <span class="shader-editor__error-head">
                  <span
                    class="shader-editor__error-kind"
                    :data-kind="error.kind"
                  >
                    {{ errorKindLabel(error) }}
                  </span>
                  <span class="shader-editor__error-stage">
                    {{ errorStageLabel(error) }}
                  </span>
                </span>
                <span class="shader-editor__error-title">
                  {{ error.title }}
                </span>
                <code class="shader-editor__error-message">
                  {{ error.message }}
                </code>
                <span v-if="error.advice" class="shader-editor__error-advice">
                  {{ error.advice }}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <StatusBar
      class="shader-editor__status"
      :line="cursorLine"
      :col="cursorCol"
      :status="status"
      :message="statusText"
    />
  </div>
</template>

<style scoped>
.shader-editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr auto;
  height: 100%;
  min-height: 0;
}

.shader-editor__left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

/* The split border belongs to the workspace below the toolbar, not to the
   chrome: the two toolbars form one continuous band across the top. */
.shader-editor__post-panel,
.shader-editor__editor-host,
.shader-editor__user-data {
  border-right: 1px solid var(--border-subtle);
}

.shader-editor__editor-host {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.shader-editor__user-data {
  flex: 1;
  min-height: 0;
}

.shader-editor__post-panel {
  flex: 0 0 auto;
  max-height: 45%;
  overflow: auto;
}

/* Let CodeMirror use the full height of its host instead of only the
   height of its current content. */
.shader-editor__editor-host :deep(.cm-editor) {
  height: 100%;
}

.shader-editor__editor-host :deep(.cm-scroller) {
  overflow: auto;
}

.shader-editor__right {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.shader-editor__canvas-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.shader-editor__canvas {
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
}

.shader-editor__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(33, 37, 43, 0.72);
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  pointer-events: none;
  z-index: 1;
}

.shader-editor__loading-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--accent-ui);
  border-radius: 50%;
  animation: shader-editor-spin 0.8s linear infinite;
}

@keyframes shader-editor-spin {
  to {
    transform: rotate(360deg);
  }
}

.shader-editor__errors {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  max-height: 45%;
  overflow: auto;
  z-index: 2;
  padding: 10px 12px;
  background: rgba(33, 37, 43, 0.96);
  border: 1px solid var(--accent-red);
  border-radius: 4px;
  box-shadow: 0 8px 24px var(--shadow);
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
}

.shader-editor__errors-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.shader-editor__errors-title {
  color: var(--accent-red);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.shader-editor__errors-count {
  color: var(--fg-muted);
  font-size: 11px;
  white-space: nowrap;
}

.shader-editor__errors-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shader-editor__errors-list li + li {
  margin-top: 2px;
}

.shader-editor__error {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 6px;
  background: transparent;
  color: inherit;
  border: 1px solid transparent;
  border-radius: 3px;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.shader-editor__error:hover,
.shader-editor__error:focus-visible {
  background: rgba(224, 108, 117, 0.14);
  border-color: rgba(224, 108, 117, 0.5);
  outline: none;
}

.shader-editor__error:disabled {
  cursor: default;
}

.shader-editor__error:disabled:hover {
  background: transparent;
  border-color: transparent;
}

.shader-editor__error-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.shader-editor__error-kind {
  display: inline-block;
  padding: 1px 5px;
  border: 1px solid rgba(224, 108, 117, 0.45);
  border-radius: 3px;
  background: rgba(224, 108, 117, 0.14);
  color: var(--accent-red);
  font-size: var(--font-size-label);
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1.5;
  text-transform: uppercase;
}

.shader-editor__error-kind[data-kind='type'] {
  border-color: rgba(209, 154, 102, 0.45);
  background: rgba(209, 154, 102, 0.14);
  color: var(--accent-orange);
}

.shader-editor__error-kind[data-kind='logic'] {
  border-color: rgba(229, 192, 123, 0.45);
  background: rgba(229, 192, 123, 0.14);
  color: var(--accent-yellow);
}

.shader-editor__error-kind[data-kind='link'] {
  border-color: rgba(198, 120, 221, 0.45);
  background: rgba(198, 120, 221, 0.14);
  color: var(--accent-purple);
}

.shader-editor__error-kind[data-kind='program'] {
  border-color: rgba(86, 182, 194, 0.45);
  background: rgba(86, 182, 194, 0.14);
  color: var(--accent-cyan);
}

.shader-editor__error-kind[data-kind='timeout'],
.shader-editor__error-kind[data-kind='internal'] {
  border-color: rgba(127, 132, 142, 0.45);
  background: rgba(127, 132, 142, 0.14);
  color: var(--fg-muted);
}

.shader-editor__error-stage {
  color: var(--fg-muted);
  font-size: 11px;
  font-weight: 500;
}

.shader-editor__error-title {
  color: var(--fg-strong);
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  font-weight: 600;
}

.shader-editor__error-message {
  color: var(--fg);
  font-family: var(--font-code);
  font-size: var(--font-size-ui);
  white-space: pre-wrap;
  word-break: break-word;
}

.shader-editor__error-advice {
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: var(--font-size-label);
  line-height: 1.45;
}

.shader-editor__status {
  grid-column: 1 / -1;
}
</style>
