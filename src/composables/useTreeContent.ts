import { computed, ref } from 'vue';
import type { ITreeNode } from '@/core/models/treeNode';
import { findFirstLeaf, findNodeById } from '@/core/utils/treeUtils';

export function useTreeContent(tree: ITreeNode[]) {
  const initial = findFirstLeaf(tree);
  const selectedId = ref<string | null>(initial?.id ?? null);

  const selectedNode = computed<ITreeNode | null>(() =>
    selectedId.value ? findNodeById(tree, selectedId.value) : null,
  );

  const content = computed<string | null>(
    () => selectedNode.value?.content ?? null,
  );

  function select(node: ITreeNode): void {
    selectedId.value = node.id;
  }

  return {
    /** All nodes in the tree (read-only, no need for reactivity yet) */
    tree,
    selectedId,
    selectedNode,
    content,
    select,
  };
}