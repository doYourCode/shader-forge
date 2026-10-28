<script setup lang="ts">
import type { EditorTab, EditorTabId } from '@/core/models/editorTab';

const props = defineProps<{
  tabs: EditorTab[];
  active: EditorTabId;
}>();

const emit = defineEmits<{
  (e: 'switch', id: EditorTabId): void;
  (e: 'compile'): void;
}>();
</script>

<template>
  <div class="editor-toolbar">
    <div class="editor-toolbar__tabs">
      <button
        v-for="tab in props.tabs"
        :key="tab.id"
        class="editor-toolbar__tab"
        :class="{ 'editor-toolbar__tab--active': tab.id === props.active }"
        @click="emit('switch', tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <button class="editor-toolbar__compile" @click="emit('compile')">
      Compile
    </button>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.editor-toolbar__tabs {
  display: flex;
  gap: 2px;
}

.editor-toolbar__tab {
  padding: 5px 12px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.12s ease, background 0.12s ease,
    border-color 0.12s ease;
}

.editor-toolbar__tab:hover {
  background: var(--bg-raised);
  color: var(--fg-strong);
}

.editor-toolbar__tab--active {
  background: var(--bg);
  border-color: var(--border);
  color: var(--fg-strong);
  box-shadow: inset 0 -2px 0 var(--accent-blue);
}

.editor-toolbar__compile {
  padding: 5px 14px;
  background: #404754;
  color: var(--fg-strong);
  border: 1px solid #4b5263;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.editor-toolbar__compile:hover {
  background: #4b5263;
  border-color: var(--accent-blue);
}

.editor-toolbar__compile:active {
  background: #3a404d;
}
</style>