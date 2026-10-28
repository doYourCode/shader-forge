<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useShaderEditor } from '@/composables/useShaderEditor';
import { editorTabs } from '@/core/models/editorTab';
import type { ShaderError } from '@/core/models/shaderError';
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
          <div class="shader-editor__errors-title">
            Shader compilation failed
          </div>
          <ul class="shader-editor__errors-list">
            <li
              v-for="(error, index) in errors"
              :key="`${error.stage}-${error.line}-${index}`"
            >
              <button
                type="button"
                class="shader-editor__error"
                @click="revealError(error)"
              >
                <span class="shader-editor__error-stage">
                  {{ errorStageLabel(error) }}
                </span>
                <span class="shader-editor__error-message">
                  {{ error.message }}
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
  border-right: 1px solid var(--border);
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
  background: rgba(24, 0, 0, 0.93);
  border: 1px solid #ff3b3b;
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  color: #ffd9d9;
  font-family: var(--font-mono);
  font-size: 12px;
}

.shader-editor__errors-title {
  margin-bottom: 8px;
  color: #ff5252;
  font-weight: 700;
  letter-spacing: 0.02em;
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
  gap: 2px;
  width: 100%;
  padding: 5px 6px;
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
  background: rgba(255, 59, 59, 0.16);
  border-color: rgba(255, 59, 59, 0.5);
  outline: none;
}

.shader-editor__error-stage {
  color: #ff7373;
  font-weight: 700;
}

.shader-editor__error-message {
  white-space: pre-wrap;
  word-break: break-word;
}

.shader-editor__status {
  grid-column: 1 / -1;
}
</style>