import type { ShaderError } from '@/core/models/shaderError';

export interface ShaderSourcePair {
  vertex: string;
  fragment: string;
}

export interface CompiledSourcePair {
  vertex: string | null;
  fragment: string | null;
}

type ShaderStage = 'vertex' | 'fragment';

const STAGE_PATTERN = /\b(VERTEX|FRAGMENT)\s+SHADER\b/i;
const ERROR_LINE_PATTERN = /(?:^|\s)0:(\d+)(?:\((\d+)\))?:\s*([^\n]*)/g;
const MAX_DIFF_CELLS = 4_000_000;

/**
 * Turns the raw GLSL info log reported by Babylon into editor-friendly errors.
 *
 * Babylon replaces a handful of GLSL ES 1.00 constructs before handing the
 * source to the driver, so driver line numbers point at the *processed* shader
 * rather than at the text in the editor. When Babylon exposes the processed
 * source we diff it against the user's source to recover the original lines.
 */
export function parseShaderCompileErrors(
  raw: string,
  source: ShaderSourcePair,
  compiled: CompiledSourcePair,
  driverLineOffset = 0,
): ShaderError[] {
  const stage = detectStage(raw);

  if (!stage) {
    return [
      {
        stage: 'program',
        line: null,
        column: null,
        message: firstUsefulLine(raw),
      },
    ];
  }

  const userSource = source[stage];
  const compiledSource = compiled[stage];
  const userLineCount = splitLines(userSource).length;
  const lineMap = compiledSource
    ? buildCompiledToUserLineMap(userSource, compiledSource)
    : null;

  const errors: ShaderError[] = [];
  const seen = new Set<string>();

  ERROR_LINE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ERROR_LINE_PATTERN.exec(raw)) !== null) {
    const compiledLine = Number.parseInt(match[1], 10);
    if (!Number.isFinite(compiledLine) || compiledLine <= 0) continue;

    const column = match[2] ? Number.parseInt(match[2], 10) : null;
    // The driver sees a few lines that Babylon prepends at compile time
    // (version pragma + defines), while the processed source does not.
    const processedLine = compiledLine - Math.max(0, driverLineOffset);
    const line =
      processedLine > 0
        ? mapCompiledLine(processedLine, lineMap, userLineCount)
        : null;
    const message = match[3].trim() || 'Shader compilation error';
    const key = `${stage}:${line}:${message}`;

    if (seen.has(key)) continue;
    seen.add(key);

    errors.push({
      stage,
      line,
      column: Number.isFinite(column) ? column : null,
      message,
    });
  }

  if (errors.length === 0) {
    return [
      {
        stage,
        line: null,
        column: null,
        message: firstUsefulLine(raw),
      },
    ];
  }

  return errors;
}

function detectStage(raw: string): ShaderStage | null {
  const match = STAGE_PATTERN.exec(raw);
  if (!match) return null;
  return match[1].toLowerCase() === 'vertex' ? 'vertex' : 'fragment';
}

function firstUsefulLine(raw: string): string {
  const lines = splitLines(raw)
    .map((line) => line.trim())
    .filter(Boolean);
  const useful = lines.find((line) => !/^at\s/.test(line)) ?? lines[0];

  return (
    useful
      ?.replace(/^Error:\s*/i, '')
      .replace(/^(VERTEX|FRAGMENT)\s+SHADER\s*/i, '')
      .trim() || 'Shader compilation failed'
  );
}

function splitLines(value: string): string[] {
  return value.replace(/\r/g, '').split('\n');
}

function mapCompiledLine(
  compiledLine: number,
  lineMap: number[] | null,
  userLineCount: number,
): number {
  const fallback = clamp(compiledLine, 1, Math.max(1, userLineCount));
  if (!lineMap || lineMap.length === 0) return fallback;

  const index = compiledLine - 1;
  if (index >= 0 && index < lineMap.length && lineMap[index] >= 0) {
    return lineMap[index] + 1;
  }

  // The driver sometimes points at a line Babylon injected (for example the
  // generated `out vec4` declaration). Fall back to the nearest line that we
  // could confidently match back to the editor source.
  for (let distance = 1; distance < lineMap.length; distance++) {
    const before = index - distance;
    if (before >= 0 && lineMap[before] >= 0) return lineMap[before] + 1;

    const after = index + distance;
    if (after < lineMap.length && lineMap[after] >= 0) return lineMap[after] + 1;
  }

  return fallback;
}

function buildCompiledToUserLineMap(
  userSource: string,
  compiledSource: string,
): number[] {
  const userLines = splitLines(userSource).map(normalizeShaderLine);
  const compiledLines = splitLines(compiledSource).map(normalizeShaderLine);
  const userCount = userLines.length;
  const compiledCount = compiledLines.length;

  if (compiledCount === 0) return [];
  if (userCount === 0 || userCount * compiledCount > MAX_DIFF_CELLS) {
    return new Array<number>(compiledCount).fill(-1);
  }

  const width = compiledCount + 1;
  const lcs = new Uint32Array((userCount + 1) * width);

  for (let user = userCount - 1; user >= 0; user--) {
    for (let compiled = compiledCount - 1; compiled >= 0; compiled--) {
      const same = linesMatch(userLines[user], compiledLines[compiled]);
      lcs[user * width + compiled] = same
        ? lcs[(user + 1) * width + compiled + 1] + 1
        : Math.max(
            lcs[(user + 1) * width + compiled],
            lcs[user * width + compiled + 1],
          );
    }
  }

  const lineMap = new Array<number>(compiledCount).fill(-1);
  let user = 0;
  let compiled = 0;

  while (user < userCount && compiled < compiledCount) {
    if (linesMatch(userLines[user], compiledLines[compiled])) {
      lineMap[compiled] = user;
      user++;
      compiled++;
    } else if (
      lcs[(user + 1) * width + compiled] >=
      lcs[user * width + compiled + 1]
    ) {
      user++;
    } else {
      compiled++;
    }
  }

  return lineMap;
}

function linesMatch(userLine: string, compiledLine: string): boolean {
  return userLine.length > 0 && userLine === compiledLine;
}

/**
 * GLSL ES 1.00 is rewritten to GLSL ES 3.00 on WebGL2. Normalising the tokens
 * that Babylon rewrites lets the diff line up user lines with compiled lines.
 */
function normalizeShaderLine(line: string): string {
  return line
    .replace(/\/\/.*$/, '')
    .replace(/\b(attribute|varying|in|out)\b/g, '@io')
    .replace(/\b(gl_FragColor|glFragColor)\b/g, '@fragColor')
    .replace(/\b(gl_FragData|glFragData)\b/g, '@fragData')
    .replace(/\bgl_FragDepthEXT\b/g, 'gl_FragDepth')
    .replace(
      /\b(texture2DProj|texture2DLodEXT|textureCubeLodEXT|texture2D|textureCube|textureLod|texture)\b/g,
      '@texture',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
