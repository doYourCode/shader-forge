export interface ITreeNode {
  /** Unique ID (used for selection, routing, etc.) */
  id: string;
  /** Label shown in the tree */
  label: string;
  /** Optional child nodes — recursive */
  children?: ITreeNode[];
  /** Payload for leaves; content body for articles/docs */
  content?: string;
  /** Optional external link (opens in new tab) */
  href?: string;
}