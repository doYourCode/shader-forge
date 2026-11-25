<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Pause, Play } from 'lucide-vue-next';

import AppBrand from '@/components/layout/AppBrand.vue';
import LanguageSwitch from '@/components/layout/LanguageSwitch.vue';
import CompileButton from '@/components/shader/CompileButton.vue';
import EditorToolbar from '@/components/shader/EditorToolbar.vue';
import PostEffectPanel from '@/components/shader/PostEffectPanel.vue';
import StatusBar from '@/components/shader/StatusBar.vue';
import UserDataPanel from '@/components/shader/UserDataPanel.vue';
import { TEXTURE_PICKER } from '@/components/shader/texturePickerContext';
import { useSandboxEditor } from '@/composables/useSandboxEditor';
import {
  postTab,
  sandboxDataTabGroup,
  sandboxStageTabGroup,
  type EditorTab,
} from '@/core/models/editorTab';
import {
  SANDBOX_USER_DATA_KINDS,
  SANDBOX_USER_DATA_STAGES,
} from '@/core/constants/sandbox';
import { sandboxExamples } from '@/core/constants/sandboxExamples';
import { postEffectExamples } from '@/core/constants/postEffectExamples';
import { useEditorDeepLink } from '@/composables/useEditorDeepLink';
import type { ShaderError } from '@/core/models/shaderError';
import { AssetPickerTexturePicker } from '@/services/assetpicker/AssetPickerTexturePicker';
import { toAssetPickerLanguage } from '@/services/assetpicker/assetPickerConfig';

const { t, locale } = useI18n();

const deepLink = useEditorDeepLink();

const editorHostRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

/** The post-effect document is standalone, like the 3D editor. */
const editorGroups = [sandboxStageTabGroup, sandboxDataTabGroup];
const editorTabs: readonly EditorTab[] = [postTab];

const sandboxPreviewStages = ['fragment', 'post'] as const;

/**
 * The texture picker is shared with the 3D editor's user-data panel. It is
 * required by `TextureSourceInput` as soon as a sampler row exists, even though
 * only `sampler2D` is offered here.
 */
const texturePicker = new AssetPickerTexturePicker({
  labels: () => ({
    title: t('userData.texture.dialog'),
    storage: t('userData.texture.bundled'),
  }),
  language: () => toAssetPickerLanguage(locale.value),
});
provide(TEXTURE_PICKER, texturePicker);

const {
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
  postEffects,
  activePostEffectId,
  tonemap,
  compile,
  mountEditor,
  mountCanvas,
  switchTab,
  loadExample,
  loadPostEffectExample,
  revealError,
  togglePaused,
  selectPostEffect,
  addPostEffect,
  removePostEffect,
  movePostEffect,
  setPostEffectEnabled,
  setTonemap,
} = useSandboxEditor({
  initialExample: deepLink.example,
  initialEffect: deepLink.effect,
  initialCode: deepLink.code,
});

const statusText = computed(() => {
  const message = statusMessage.value;
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

function isRevealable(error: ShaderError): boolean {
  if (error.stage === 'user_data') return error.row != null;
  return (
    (error.stage === 'fragment' || error.stage === 'post') &&
    error.line !== null
  );
}

function onSandboxExampleChange(event: Event): void {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) return;
  if (select.value) loadExample(select.value);
  select.value = '';
}

onMounted(() => {
  if (editorHostRef.value) mountEditor(editorHostRef.value);
  if (canvasRef.value) mountCanvas(canvasRef.value);
});

onBeforeUnmount(() => {
  texturePicker.dispose();
});
</script>

<template>
  <div class="sandbox-editor">
    <div class="sandbox-editor__left">
      <EditorToolbar
        :groups="editorGroups"
        :tabs="editorTabs"
        :active="activeTab"
        :show-examples="false"
        @switch="switchTab"
      >
        <template #brand>
          <AppBrand />
        </template>
      </EditorToolbar>

      <PostEffectPanel
        v-if="activeTab === 'post'"
        class="sandbox-editor__post-panel"
        :effects="postEffects"
        :active-id="activePostEffectId"
        :tonemap="tonemap"
        :examples="postEffectExamples"
        @select="selectPostEffect"
        @add="addPostEffect"
        @remove="removePostEffect"
        @move="movePostEffect"
        @toggle="setPostEffectEnabled"
        @tonemap="setTonemap"
        @load-example="loadPostEffectExample"
      />

      <div
        v-show="activeTab !== 'user_data'"
        ref="editorHostRef"
        class="sandbox-editor__editor-host"
      />

      <UserDataPanel
        v-if="activeTab === 'user_data'"
        class="sandbox-editor__user-data"
        :definitions="userDataDoc.definitions"
        :highlighted-row="highlightedUserRow"
        :validate-name="userDataCommands.validateName"
        :stages="SANDBOX_USER_DATA_STAGES"
        :kinds="SANDBOX_USER_DATA_KINDS"
        :preview-stages="sandboxPreviewStages"
        block-mode="sandbox"
        @add="userDataCommands.add"
        @remove="userDataCommands.remove"
        @rename="userDataCommands.rename"
        @change-kind="userDataCommands.changeKind"
        @change-stages="userDataCommands.changeStages"
        @change-value="userDataCommands.setValue"
      />
    </div>

    <div class="sandbox-editor__right">
      <div class="sandbox-editor__viewer-toolbar">
        <label class="sandbox-editor__example-select">
          <span>{{ t('editor.examples.sandbox') }}</span>
          <select value="" @change="onSandboxExampleChange">
            <option value="">{{ t('editor.examples.loadExample') }}</option>
            <option
              v-for="example in sandboxExamples"
              :key="example.id"
              :value="example.id"
            >
              {{ example.label }}
            </option>
          </select>
        </label>

        <CompileButton @compile="compile" />

        <button
          type="button"
          class="sandbox-editor__viewer-btn"
          :class="{ 'sandbox-editor__viewer-btn--active': paused }"
          @click="togglePaused"
        >
          <Play v-if="paused" :size="13" aria-hidden="true" />
          <Pause v-else :size="13" aria-hidden="true" />
          <span>{{ paused ? t('editor.resume') : t('editor.pause') }}</span>
        </button>

        <LanguageSwitch />
      </div>

      <div class="sandbox-editor__canvas-wrap">
        <canvas ref="canvasRef" class="sandbox-editor__canvas" />

        <code class="sandbox-editor__abi" aria-hidden="true">
          vUv · uResolution · uTime · user data · post effects
        </code>

        <div
          v-if="errors.length"
          class="sandbox-editor__errors"
          role="alert"
          aria-live="assertive"
        >
          <div class="sandbox-editor__errors-header">
            <span class="sandbox-editor__errors-title">
              {{ t('editor.error.title') }}
            </span>
            <span class="sandbox-editor__errors-count">
              {{ t('editor.error.count', { count: errors.length }) }}
            </span>
          </div>

          <ul class="sandbox-editor__errors-list">
            <li
              v-for="(error, index) in errors"
              :key="`${error.stage}-${error.line}-${index}`"
            >
              <button
                type="button"
                class="sandbox-editor__error"
                :disabled="!isRevealable(error)"
                @click="revealError(error)"
              >
                <span class="sandbox-editor__error-head">
                  <span
                    class="sandbox-editor__error-kind"
                    :data-kind="error.kind"
                  >
                    {{ t(`editor.error.kind.${error.kind}`) }}
                  </span>
                  <span class="sandbox-editor__error-stage">
                    {{ errorStageLabel(error) }}
                  </span>
                </span>
                <span class="sandbox-editor__error-title">
                  {{ error.title }}
                </span>
                <code class="sandbox-editor__error-message">
                  {{ error.message }}
                </code>
                <span v-if="error.advice" class="sandbox-editor__error-advice">
                  {{ error.advice }}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <StatusBar
      class="sandbox-editor__status"
      :line="cursorLine"
      :col="cursorCol"
      :status="status"
      :message="statusText"
    />
  </div>
</template>

<style scoped>
.sandbox-editor {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr auto;
  height: 100%;
  min-height: 0;
  background: var(--bg);
}

.sandbox-editor__left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--border-subtle);
}

.sandbox-editor__editor-host {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sandbox-editor__editor-host :deep(.cm-editor) {
  height: 100%;
}

.sandbox-editor__editor-host :deep(.cm-scroller) {
  overflow: auto;
}

.sandbox-editor__post-panel {
  flex: 0 0 auto;
  max-height: 45%;
  overflow: auto;
}

.sandbox-editor__user-data {
  flex: 1;
  min-height: 0;
}

.sandbox-editor__right {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.sandbox-editor__viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-height: 38px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.sandbox-editor__viewer-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-raised);
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  cursor: pointer;
}

.sandbox-editor__viewer-btn:hover {
  border-color: #4b5263;
  background: #3a404d;
  color: var(--fg-strong);
}

.sandbox-editor__viewer-btn--active {
  border-color: var(--accent-ui);
  background: #404754;
  color: var(--fg-strong);
}

.sandbox-editor__example-select {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 11px;
}

.sandbox-editor__example-select select {
  max-width: 170px;
  padding: 4px 6px;
  background: var(--bg-input);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-ui);
  font-size: 11px;
}

.sandbox-editor__canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--viewport-bg);
}

.sandbox-editor__canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}

.sandbox-editor__abi {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 4px 7px;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background: rgba(17, 21, 27, 0.66);
  color: var(--fg-subtle);
  font-family: var(--font-code);
  font-size: 10px;
  pointer-events: none;
}

.sandbox-editor__errors {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  max-height: 50%;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--accent-red);
  border-radius: 4px;
  background: rgba(33, 37, 43, 0.96);
  box-shadow: 0 8px 24px var(--shadow);
  color: var(--fg);
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
}

.sandbox-editor__errors-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.sandbox-editor__errors-title {
  color: var(--accent-red);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sandbox-editor__errors-count {
  color: var(--fg-muted);
  font-size: 11px;
  white-space: nowrap;
}

.sandbox-editor__errors-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.sandbox-editor__error {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sandbox-editor__error:hover,
.sandbox-editor__error:focus-visible {
  border-color: rgba(224, 108, 117, 0.5);
  background: rgba(224, 108, 117, 0.14);
  outline: none;
}

.sandbox-editor__error:disabled {
  cursor: default;
}

.sandbox-editor__error:disabled:hover {
  border-color: transparent;
  background: transparent;
}

.sandbox-editor__error-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.sandbox-editor__error-kind {
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

.sandbox-editor__error-kind[data-kind='type'] {
  border-color: rgba(209, 154, 102, 0.45);
  background: rgba(209, 154, 102, 0.14);
  color: var(--accent-orange);
}

.sandbox-editor__error-kind[data-kind='logic'] {
  border-color: rgba(229, 192, 123, 0.45);
  background: rgba(229, 192, 123, 0.14);
  color: var(--accent-yellow);
}

.sandbox-editor__error-kind[data-kind='link'] {
  border-color: rgba(198, 120, 221, 0.45);
  background: rgba(198, 120, 221, 0.14);
  color: var(--accent-purple);
}

.sandbox-editor__error-kind[data-kind='program'],
.sandbox-editor__error-kind[data-kind='internal'] {
  border-color: rgba(86, 182, 194, 0.45);
  background: rgba(86, 182, 194, 0.14);
  color: var(--accent-cyan);
}

.sandbox-editor__error-stage {
  color: var(--fg-muted);
  font-size: 11px;
  font-weight: 500;
}

.sandbox-editor__error-title {
  color: var(--fg-strong);
  font-size: var(--font-size-ui);
  font-weight: 600;
}

.sandbox-editor__error-message {
  color: var(--fg);
  font-family: var(--font-code);
  font-size: var(--font-size-ui);
  white-space: pre-wrap;
  word-break: break-word;
}

.sandbox-editor__error-advice {
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: var(--font-size-label);
  line-height: 1.45;
}

.sandbox-editor__status {
  grid-column: 1 / -1;
}

@media (max-width: 860px) {
  .sandbox-editor {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) minmax(240px, 42vh) auto;
  }

  .sandbox-editor__left {
    border-right: 0;
    border-bottom: 1px solid var(--border-subtle);
  }
}
</style>
