import { uniformKindMeta } from '@/core/constants/userUniformKinds';
import {
  isSamplerKind,
  type UserDataDocument,
  type UserTextureSource,
  type UserUniformDefinition,
  type UserUniformKind,
  type UserUniformStage,
  type UserUniformValue,
} from '@/core/models/userUniform';

/**
 * Projection of a `UserDataDocument` onto GLSL. The generated block is wrapped
 * in sentinel comments so it can be recognised (and attributed) in the source
 * the driver actually compiles.
 *
 * Initializers are deliberately never emitted: a `uniform float x = 1.0;` is
 * illegal in GLSL ES 1.00, which this project still supports.
 */

export const USER_DATA_BLOCK_START = '// >>> ShaderForge user data';
export const USER_DATA_BLOCK_END = '// <<< end ShaderForge user data >>>';
const BLOCK_START_LINE = `${USER_DATA_BLOCK_START} (managed block — edit it in the User data tab)`;

/** The two GLSL stages a block can be injected into. */
export type InjectedStage = 'vertex' | 'fragment';

export interface GeneratedUserDataBlock {
  /** Full block, sentinels included, in insertion order. */
  readonly lines: readonly string[];
  /** Definition index per block line; -1 for sentinels and the values comment. */
  readonly declarationRows: readonly number[];
}

/** 1-based, inclusive range of the injected block inside a stage source. */
export interface InjectedBlockRange {
  readonly startLine: number;
  readonly endLine: number;
}

export interface StageAssembly {
  readonly source: string;
  readonly injected: InjectedBlockRange | null;
  readonly declarationRowByLine: readonly number[];
}

/** Per-stage diagnostic metadata carried on the material blueprint. */
export interface StageAssemblyRecord {
  readonly injected: InjectedBlockRange | null;
  readonly declarationRowByLine: readonly number[];
}

export interface UserDataAssemblyRecord {
  readonly vertex: StageAssemblyRecord | null;
  readonly fragment: StageAssemblyRecord | null;
}

export interface UserDataAssembly {
  readonly vertex: string;
  readonly fragment: string;
  readonly record: UserDataAssemblyRecord;
}

/**
 * Builds the block for one stage, or null when no definition targets it. The
 * document order is preserved so a row index in the table is also the index in
 * `declarationRows`.
 */
export function generateBlock(
  document: UserDataDocument,
  stage: InjectedStage,
): GeneratedUserDataBlock | null {
  const targeted = document.definitions
    .map((definition, row) => ({ definition, row }))
    .filter(({ definition }) => targetsStage(definition.stages, stage));

  if (targeted.length === 0) return null;

  const lines: string[] = [BLOCK_START_LINE];
  const rows: number[] = [-1];

  for (const { definition, row } of targeted) {
    const meta = uniformKindMeta(definition.kind);
    lines.push(`uniform ${meta.glslType} ${definition.name}; // ${meta.hint}`);
    rows.push(row);
  }

  lines.push(
    `// current values: ${describeValues(
      targeted.map(({ definition }) => definition),
    )}`,
  );
  rows.push(-1);
  lines.push(USER_DATA_BLOCK_END);
  rows.push(-1);

  return { lines, declarationRows: rows };
}

/**
 * Inserts the block after the leading `#version`/`precision` lines of the
 * stage. Blank lines and comments inside that run are tolerated; the first
 * other construct ends the run. Leading preamble comments never move the
 * insertion point before `#version` (which would be illegal GLSL).
 */
export function assembleStage(
  source: string,
  block: GeneratedUserDataBlock | null,
): StageAssembly {
  if (!block) {
    return { source, injected: null, declarationRowByLine: [] };
  }

  const lines = splitLines(source);
  const insertionIndex = findInsertionIndex(lines);
  const before = lines.slice(0, insertionIndex);
  const after = lines.slice(insertionIndex);

  const assembled = [...before];
  if (before.length > 0 && before[before.length - 1].trim() !== '') {
    assembled.push('');
  }

  const startIndex = assembled.length;
  assembled.push(...block.lines);
  const endIndex = assembled.length - 1;

  if (after.length > 0 && after[0].trim() !== '') {
    assembled.push('');
  }
  assembled.push(...after);

  return {
    source: assembled.join('\n'),
    injected: { startLine: startIndex + 1, endLine: endIndex + 1 },
    declarationRowByLine: block.declarationRows,
  };
}

/**
 * Assembles both stages and records where each block ended up. The record is
 * carried on the material blueprint and consumed by the diagnostics parser.
 */
export function assembleUserData(
  document: UserDataDocument,
  vertexSource: string,
  fragmentSource: string,
): UserDataAssembly {
  const vertex = assembleStage(vertexSource, generateBlock(document, 'vertex'));
  const fragment = assembleStage(
    fragmentSource,
    generateBlock(document, 'fragment'),
  );

  return {
    vertex: vertex.source,
    fragment: fragment.source,
    record: {
      vertex: toRecord(vertex),
      fragment: toRecord(fragment),
    },
  };
}

/**
 * Locates the injected block inside the exact source handed to the driver.
 * The sentinels are unique, so this works regardless of how many lines Babylon
 * prepended before compiling.
 */
export function locateInjectedBlock(source: string): InjectedBlockRange | null {
  const lines = splitLines(source);
  let startLine: number | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trimStart();

    if (startLine === null) {
      if (line.startsWith(USER_DATA_BLOCK_START)) startLine = index + 1;
      continue;
    }

    if (line.startsWith(USER_DATA_BLOCK_END)) {
      return { startLine, endLine: index + 1 };
    }
  }

  return null;
}

function toRecord(assembly: StageAssembly): StageAssemblyRecord | null {
  if (!assembly.injected) return null;
  return {
    injected: assembly.injected,
    declarationRowByLine: assembly.declarationRowByLine,
  };
}

function targetsStage(stage: UserUniformStage, target: InjectedStage): boolean {
  return stage === 'both' || stage === target;
}

function findInsertionIndex(lines: readonly string[]): number {
  let insertionIndex = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();

    if (line === '' || line.startsWith('//')) continue;

    // `#extension` must also precede any declaration, so it belongs to the
    // header run even though the contract only names #version/precision.
    if (
      /^#version\b/i.test(line) ||
      /^precision\b/i.test(line) ||
      /^#extension\b/i.test(line)
    ) {
      insertionIndex = index + 1;
      continue;
    }

    break;
  }

  return insertionIndex;
}

function splitLines(source: string): string[] {
  return source.replace(/\r/g, '').split('\n');
}

function describeValues(
  definitions: readonly UserUniformDefinition[],
): string {
  return definitions
    .map((definition) => `${definition.name} = ${formatValue(definition.kind, definition.value)}`)
    .join('; ');
}

function formatValue(kind: UserUniformKind, value: UserUniformValue): string {
  if (isSamplerKind(kind)) {
    const source = value as UserTextureSource;
    if (source.kind === 'file') return `file:${source.file.name}`;
    if (source.kind === 'repository') {
      return source.textureId.trim().length > 0
        ? `repo:${source.textureId}`
        : '(unset)';
    }
    return source.url && source.url.length > 0 ? source.url : '(unset)';
  }

  if (typeof value === 'number') return formatNumber(value);

  const record = value as unknown as Record<string, number>;
  const keys = valueKeys(kind);
  return `(${keys.map((key) => formatNumber(record[key] ?? 0)).join(', ')})`;
}

function valueKeys(kind: UserUniformKind): readonly string[] {
  switch (kind) {
    case 'vec2':
      return ['x', 'y'];
    case 'vec3':
    case 'direction':
    case 'position':
      return ['x', 'y', 'z'];
    case 'vec4':
      return ['x', 'y', 'z', 'w'];
    case 'color':
      return ['r', 'g', 'b'];
    case 'color4':
      return ['r', 'g', 'b', 'a'];
    default:
      return [];
  }
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4)));
}
