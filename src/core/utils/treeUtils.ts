import type { ITreeNode } from '@/core/models/treeNode';

export function findNodeById(
  nodes: ITreeNode[],
  id: string,
): ITreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Returns the first leaf with content — used as default selection. */
export function findFirstLeaf(nodes: ITreeNode[]): ITreeNode | null {
  for (const node of nodes) {
    if (!node.children && node.content) return node;
    if (node.children) {
      const found = findFirstLeaf(node.children);
      if (found) return found;
    }
  }
  return null;
}