import type { ITreeNode } from '@/core/models/treeNode';

export function findNodeById(nodes: ITreeNode[], id: string): ITreeNode | null {
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

/**
 * Leaves in display order, across every section. The content pager and the
 * learning path both use this order, so prev/next always matches the tree.
 */
export function flattenLeaves(nodes: readonly ITreeNode[]): ITreeNode[] {
  const leaves: ITreeNode[] = [];

  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      leaves.push(...flattenLeaves(node.children));
    } else if (node.content) {
      leaves.push(node);
    }
  }

  return leaves;
}
