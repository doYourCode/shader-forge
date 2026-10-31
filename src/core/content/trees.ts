import type { ITreeNode } from '@/core/models/treeNode';
import { parseFrontmatter, type ParsedFile } from './frontmatter';

type ContentKind = 'docs' | 'knowledge';

type ContentData = {
  title?: string;
  description?: string;
  section?: string;
  order?: number;
  draft?: boolean;
};

type SectionMeta = {
  id: string;
  label: string;
};

const SECTIONS: Record<ContentKind, SectionMeta[]> = {
  docs: [
    { id: 'api', label: 'API Reference' },
    { id: 'guides', label: 'Guides' },
  ],
  knowledge: [
    { id: 'basics', label: 'Shader Basics' },
    { id: 'glsl', label: 'GLSL' },
    { id: 'webgl', label: 'WebGL & WebGPU' },
  ],
};

const docsFiles = import.meta.glob('/content/docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const knowledgeFiles = import.meta.glob('/content/knowledge/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function idFromPath(path: string): string {
  return path.split('/').pop()!.replace(/\.md$/i, '');
}

function readContent(path: string, raw: string): ParsedFile<ContentData> {
  try {
    return parseFrontmatter<ContentData>(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid frontmatter in ${path}: ${message}`);
  }
}

function buildTree(
  kind: ContentKind,
  files: Record<string, string>,
): ITreeNode[] {
  const buckets = new Map<
    string,
    { node: ITreeNode; order: number }[]
  >();

  for (const [path, raw] of Object.entries(files)) {
    const { data, body } = readContent(path, raw);

    // Drafts are visible in `npm run dev` but excluded from production builds.
    if (data.draft === true && !import.meta.env.DEV) continue;

    const id = idFromPath(path);
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const section =
      typeof data.section === 'string' && data.section.trim()
        ? data.section.trim()
        : 'uncategorized';

    const node: ITreeNode = {
      id,
      label: title || id,
      content: body,
    };

    const order =
      typeof data.order === 'number' && Number.isFinite(data.order)
        ? data.order
        : Number.MAX_SAFE_INTEGER;

    const bucket = buckets.get(section);
    if (bucket) bucket.push({ node, order });
    else buckets.set(section, [{ node, order }]);
  }

  const sectionMeta = SECTIONS[kind];
  const sectionRank = new Map<string, number>(
    sectionMeta.map((section, index) => [section.id, index]),
  );

  return [...buckets.entries()]
    .sort(([a], [b]) => {
      const rankA = sectionRank.get(a) ?? Number.MAX_SAFE_INTEGER;
      const rankB = sectionRank.get(b) ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB || a.localeCompare(b);
    })
    .map(([section, entries]) => ({
      id: `${kind}-${section}`,
      label:
        sectionMeta.find((candidate) => candidate.id === section)?.label ??
        section,
      children: entries
        .sort(
          (a, b) =>
            a.order - b.order || a.node.label.localeCompare(b.node.label),
        )
        .map((entry) => entry.node),
    }));
}

export const docsTree = buildTree('docs', docsFiles);
export const knowledgeTree = buildTree('knowledge', knowledgeFiles);