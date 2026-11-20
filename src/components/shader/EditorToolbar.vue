<script setup lang="ts">
import { CirclePlay } from 'lucide-vue-next';

import type {
  EditorTab,
  EditorTabGroup,
  EditorTabId,
} from '@/core/models/editorTab';
import ShaderExamplePicker from './ShaderExamplePicker.vue';
import TabGroupMenu from './TabGroupMenu.vue';

const props = defineProps<{
  /** Document groups rendered as dropdown triggers, in order. */
  groups: readonly EditorTabGroup[];
  /** Documents that stand on their own, rendered after the groups. */
  tabs: readonly EditorTab[];
  active: EditorTabId;
}>();

const emit = defineEmits<{
  (e: 'switch', id: EditorTabId): void;
  (e: 'compile'): void;
  (e: 'load-example', id: string): void;
}>();
</script>

<template>
  <div class="editor-toolbar">
    <div class="editor-toolbar__lead">
      <slot name="brand" />

      <div class="editor-toolbar__tabs">
        <TabGroupMenu
          v-for="group in props.groups"
          :key="group.id"
          :group="group"
          :active="props.active"
          @switch="emit('switch', $event)"
        />

        <button
          v-for="tab in props.tabs"
          :key="tab.id"
          type="button"
          class="editor-toolbar__tab"
          :class="{ 'editor-toolbar__tab--active': tab.id === props.active }"
          @click="emit('switch', tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div class="editor-toolbar__actions">
      <ShaderExamplePicker @pick="emit('load-example', $event)" />

      <button
        type="button"
        class="editor-toolbar__compile"
        @click="emit('compile')"
      >
        <CirclePlay :size="13" aria-hidden="true" />
        <span>Compile</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  row-gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.editor-toolbar__lead {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.editor-toolbar__tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  min-width: 0;
}

.editor-toolbar__tab {
  padding: 5px 12px;
  background: transparent;
  color: var(--fg-muted);
  border: 1px solid transparent;
  border-radius: 4px;
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 0.12s ease,
    background 0.12s ease,
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
  box-shadow: inset 0 -2px 0 var(--accent-ui);
}

.editor-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.editor-toolbar__compile {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  background: var(--action-primary);
  color: var(--action-primary-contrast);
  border: 1px solid var(--action-primary);
  border-radius: 4px;
  font-family: var(--font-ui);
  font-size: var(--font-size-ui);
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(152, 195, 121, 0.3);
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
}

.editor-toolbar__compile:hover {
  background: var(--action-primary-hover);
  border-color: var(--action-primary-hover);
}

.editor-toolbar__compile:active {
  background: var(--action-primary-active);
  border-color: var(--action-primary-active);
}
</style>
