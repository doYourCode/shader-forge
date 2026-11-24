import { uniformKindMeta } from '@/core/constants/userUniformKinds';
import type {
  InjectedBlockRange,
  StageAssemblyRecord,
  UserDataAssemblyRecord,
} from '@/core/models/userDataAssembly';
import { findInjectionLine } from './injectionPoint';
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

/** The GLSL targets a block can be injected into. */
export type InjectedStage = 'vertex' | 'fragment' | 'post';

export interface GeneratedUserDataBlock {
  /** Full block, sentinels included, in insertion order. */
  readonly lines: readonly string[];
  /** Definition index per block line; -1 for sentinels and the values comment. */
  readonly declarationRows: readonly number[];
}

/** 1-based, inclusive range of the injected block inside a stage source. */
export interface StageAssembly {
  readonly source: string;
  readonly injected: InjectedBlockRange | null;
  readonly declarationRowByLine: readonly number[];
}

export interface UserDataAssembly {
  readonly vertex: string;
  readonly fragment: string;
  readonly record: UserDataAssemblyRecord;
}

// Keep the assembly metadata importable from the codegen that produces it.
export type {
  InjectedBlockRange,
  StageAssemblyRecord,
  UserDataAssemblyRecord,
} from '@/core/models/userDataAssembly';

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

  return buildBlock(targeted);
}

/**
 * Builds the block for the 2D sandbox's single fragment document.
 *
 * The sandbox has no separate vertex stage; fragment, post and the combined
 * "both" option all target the same fullscreen pass, so they share one block.
 * A definition explicitly targeting the (non-existent) vertex stage is ignored.
 */
export function generateSandboxBlock(
  document: UserDataDocument,
): GeneratedUserDataBlock | null {
  const targeted = document.definitions
    .map((definition, row) => ({ definition, row }))
    .filter(({ definition }) => isSandboxTarget(definition.stages));

  return buildBlock(targeted);
}

function buildBlock(
  targeted: readonly {
    readonly definition: UserUniformDefinition;
    readonly row: number;
  }[],
): GeneratedUserDataBlock | null {
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
  const insertionIndex = findInjectionLine(lines);
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
      vertex: toStageAssemblyRecord(vertex),
      fragment: toStageAssemblyRecord(fragment),
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

/** Projects an assembled stage into the diagnostic record carried by a blueprint. */
export function toStageAssemblyRecord(
  assembly: StageAssembly,
): StageAssemblyRecord | null {
  if (!assembly.injected) return null;
  return {
    injected: assembly.injected,
    declarationRowByLine: assembly.declarationRowByLine,
  };
}

function targetsStage(stage: UserUniformStage, target: InjectedStage): boolean {
  if (stage === 'both') return target === 'vertex' || target === 'fragment';
  return stage === target;
}

function isSandboxTarget(stage: UserUniformStage): boolean {
  return stage === 'fragment' || stage === 'post' || stage === 'both';
}

function splitLines(source: string): string[] {
  return source.replace(/\r/g, '').split('\n');
}

function describeValues(definitions: readonly UserUniformDefinition[]): string {
  return definitions
    .map(
      (definition) =>
        `${definition.name} = ${formatValue(definition.kind, definition.value)}`,
    )
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
