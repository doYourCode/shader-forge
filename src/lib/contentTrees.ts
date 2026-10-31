import type { ITreeNode } from '@/core/models/treeNode';
import type { ContentKind, ContentResolver } from './ContentResolver';
import { DEFAULT_LOCALE, PT_BR_LOCALE, type Locale } from './locales';

type SectionMeta = {
  id: string;
  labels: Record<Locale, string>;
};

/**
 * Section order and labels. Content-level navigation strings live here (not in
 * the UI-string i18n catalogue), because sections are part of the content
 * schema declared in `.pages.yml`.
 */
const SECTIONS: Record<ContentKind, SectionMeta[]> = {
  docs: [
    {
      id: 'api',
      labels: { [DEFAULT_LOCALE]: 'API Reference', [PT_BR_LOCALE]: 'Referência da API' },
    },
    {
      id: 'guides',
      labels: { [DEFAULT_LOCALE]: 'Guides', [PT_BR_LOCALE]: 'Guias' },
    },
  ],
  knowledge: [
    {
      id: 'basics',
      labels: { [DEFAULT_LOCALE]: 'Shader Basics', [PT_BR_LOCALE]: 'Fundamentos de Shader' },
    },
    {
      id: 'glsl',
      labels: { [DEFAULT_LOCALE]: 'GLSL', [PT_BR_LOCALE]: 'GLSL' },
    },
    {
      id: 'webgl',
      labels: { [DEFAULT_LOCALE]: 'WebGL & WebGPU', [PT_BR_LOCALE]: 'WebGL e WebGPU' },
    },
  ],
};

/** `docs/shader-editor.md` → `shader-editor`. */
export function slugFromRelativePath(relativePath: string): string {
  const file = relativePath.split('/').pop() ?? relativePath;
  return file.replace(/\.md$/i, '');
}

/**
 * Builds the tree for one kind + locale through the resolver, so fallback is
 * decided in exactly one place. Paths that resolve to nothing (missing, or an
 * unpublished draft) are omitted.
 *
 * The node spine is the union of paths across locales; identical relative
 * paths are the translation key, so a translated document keeps its position.
 */
export async function buildContentTree(
  resolver: ContentResolver,
  kind: ContentKind,
  locale: Locale,
): Promise<ITreeNode[]> {
  const relativePaths = resolver.relativePaths(kind);
  const results = await Promise.all(
    relativePaths.map((relativePath) => resolver.resolve(relativePath, locale)),
  );

  const docs = results.flatMap((result) =>
    result.content ? [result.content] : [],
  );

  const buckets = new Map<string, { node: ITreeNode; order: number }[]>();

  for (const doc of docs) {
    const section = doc.section || 'uncategorized';
    const slug = slugFromRelativePath(doc.relativePath);
    const node: ITreeNode = {
      id: slug,
      label: doc.title || slug,
      content: doc.body,
    };

    const entry = {
      node,
      order:
        typeof doc.order === 'number' ? doc.order : Number.MAX_SAFE_INTEGER,
    };

    const bucket = buckets.get(section);
    if (bucket) bucket.push(entry);
    else buckets.set(section, [entry]);
  }

  const sectionMeta = SECTIONS[kind];
  const sectionRank = new Map(
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
        sectionMeta.find((candidate) => candidate.id === section)?.labels[
          locale
        ] ?? section,
      children: entries
        .sort(
          (a, b) =>
            a.order - b.order ||
            a.node.label.localeCompare(b.node.label, locale),
        )
        .map((entry) => entry.node),
    }));
}
