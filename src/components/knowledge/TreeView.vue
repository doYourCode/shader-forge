<script setup lang="ts">
import type { ITreeNode } from '@/core/models/treeNode';

defineOptions({ name: 'TreeView' });

const props = withDefaults(
  defineProps<{
    nodes: ITreeNode[];
    /** Selected leaf id (controlled by parent) */
    selectedId?: string | null;
    /** Internal: depth of the current recursion level */
    depth?: number;
  }>(),
  {
    selectedId: null,
    depth: 0,
  },
);

const emit = defineEmits<{
  (e: 'select', node: ITreeNode): void;
}>();

function isLeaf(node: ITreeNode): boolean {
  return !node.children || node.children.length === 0;
}

function onClick(node: ITreeNode): void {
  if (isLeaf(node)) emit('select', node);
}
</script>

<template>
  <ul class="tree" :style="{ '--depth': depth }">
    <li
      v-for="node in nodes"
      :key="node.id"
      class="tree__item"
    >
      <!-- LEAF: clickable -->
      <button
        v-if="isLeaf(node)"
        type="button"
        class="tree__leaf"
        :class="{ 'tree__leaf--selected': node.id === selectedId }"
        @click="onClick(node)"
      >
        {{ node.label }}
      </button>

      <!-- BRANCH: label + recursive children -->
      <template v-else>
        <span class="tree__branch">{{ node.label }}</span>
        <TreeView
          :nodes="node.children!"
          :selected-id="selectedId"
          :depth="depth + 1"
          @select="emit('select', $event)"
        />
      </template>
    </li>
  </ul>
</template>

<style scoped>
.tree {
  list-style: none;
  margin: 0;
  padding-left: calc(var(--depth) * 0.9rem);
  font-family: var(--font-mono);
  font-size: 0.85rem;
}

.tree__item {
  margin: 0.15rem 0;
}

.tree__branch {
  display: block;
  font-weight: 700;
  padding: 0.25rem 0.4rem;
  color: #444;
}

.tree__leaf {
  appearance: none;
  background: transparent;
  border: none;
  text-align: left;
  width: 100%;
  padding: 0.25rem 0.4rem;
  font: inherit;
  cursor: pointer;
  color: inherit;
}

.tree__leaf:hover {
  background: #eee;
}

.tree__leaf--selected {
  background: #000;
  color: #fff;
}
</style>