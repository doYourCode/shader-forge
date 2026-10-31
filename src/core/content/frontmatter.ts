import { parse as parseYaml } from 'yaml';

export interface ParsedFile<T> {
  data: T;
  body: string;
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;

export function parseFrontmatter<T extends object>(raw: string): ParsedFile<T> {
  const source = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = FRONTMATTER.exec(source);

  if (!match) {
    return { data: {} as unknown as T, body: source };
  }

  const parsed = parseYaml(match[1]);
  const data = (
    parsed !== null && typeof parsed === 'object' ? parsed : {}
  ) as unknown as T;

  return {
    data,
    body: source.slice(match[0].length).replace(/^\n+/, ''),
  };
}