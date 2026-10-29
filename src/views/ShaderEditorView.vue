<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useShaderEditor } from '@/composables/useShaderEditor';
import { editorTabs } from '@/core/models/editorTab';
import type { ShaderError, ShaderErrorKind } from '@/core/models/shaderError';
import EditorToolbar from '@/components/shader/EditorToolbar.vue';
import ViewerToolbar from '@/components/shader/ViewerToolbar.vue';
import StatusBar from '@/components/shader/StatusBar.vue';

const editorHostRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const {
  activeTab,
  cursorLine,
  cursorCol,
  status,
  statusMessage,
  wireframe,
  paused,
  errors,
  mountEditor,
  mountCanvas,
  switchTab,
  compile,
  revealError,
  resize,
  setWireframe,
  setPaused,
} = useShaderEditor();

const ERROR_KIND_LABELS: Record<ShaderErrorKind, string> = {
  syntax: 'Syntax',
  type: 'Type',
  logic: 'Logic',
  link: 'Link',
  program: 'Compiler',
  timeout: 'Timeout',
  internal: 'Internal',
};

function errorStageLabel(error: ShaderError): string {
  const stage =
    error.stage === 'vertex'
      ? 'Vertex shader'
      : error.stage === 'fragment'
        ? 'Fragment shader'
        : 'Shader program';

  return error.line === null
    ? stage
    : `${stage} · line ${error.line}${
        error.column === null ? '' : `, col ${error.column}`
      }`;
}

function errorKindLabel(error: ShaderError): string {
  return ERROR_KIND_LABELS[error.kind];
}

function isRevealable(error: ShaderError): boolean {
  return error.stage !== 'program' && error.line !== null;
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
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
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
        :tabs="editorTabs"
        :active="activeTab"
        @switch="switchTab"
        @compile="compile"
      />
      <div ref="editorHostRef" class="shader-editor__editor-host" />
    </div>

    <div class="shader-editor__right">
      <ViewerToolbar
        :wireframe="wireframe"
        :paused="paused"
        @toggle-wireframe="toggleWireframe"
        @toggle-pause="togglePause"
      />
      <div class="shader-editor__canvas-wrap">
        <canvas ref="canvasRef" class="shader-editor__canvas" />

        <div
          v-if="errors.length"
          class="shader-editor__errors"
          role="alert"
          aria-live="assertive"
        >
          <div class="shader-editor__errors-header">
            <span class="shader-editor__errors-title">
              Shader compilation failed
            </span>
            <span class="shader-editor__errors-count">
              {{ errors.length }} {{ errors.length === 1 ? 'error' : 'errors' }}
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
      :message="statusMessage"
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
  border-right: 1px solid var(--border-subtle);
}

.shader-editor__editor-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
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
  font-family: var(--font-mono);
  font-size: 12px;
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
  font-size: 9px;
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
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
}

.shader-editor__error-message {
  color: var(--fg);
  font-size: 11.5px;
  white-space: pre-wrap;
  word-break: break-word;
}

.shader-editor__error-advice {
  color: var(--fg-muted);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.45;
}

.shader-editor__status {
  grid-column: 1 / -1;
}
</style>