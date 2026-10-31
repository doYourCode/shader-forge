const MAX_DIFF_CELLS = 4_000_000;

/**
 * Maps lines from the source that was handed to WebGL back to the user's
 * editor source.
 *
 * Babylon rewrites GLSL ES 1.00 to GLSL ES 3.00 on WebGL2: it injects
 * `#version`/`#define` lines and, for fragment shaders, prepends an
 * `out vec4` declaration. Driver line numbers therefore do not always match
 * editor line numbers. A longest-common-subsequence diff recovers the mapping
 * without relying on a fragile fixed offset.
 */
export class ShaderLineMap {
  private readonly userIndexByDriverLine: readonly number[];
  private readonly userLineCount: number;

  private constructor(
    userIndexByDriverLine: readonly number[],
    userLineCount: number,
  ) {
    this.userIndexByDriverLine = userIndexByDriverLine;
    this.userLineCount = userLineCount;
  }

  static between(driverSource: string, userSource: string): ShaderLineMap | null {
    const userLines = splitLines(userSource).map(normalizeShaderLine);
    const driverLines = splitLines(driverSource).map(normalizeShaderLine);
    const userCount = userLines.length;
    const driverCount = driverLines.length;

    if (driverCount === 0 || userCount === 0) return null;
    if (userCount * driverCount > MAX_DIFF_CELLS) return null;

    const width = driverCount + 1;
    const lcs = new Uint32Array((userCount + 1) * width);

    for (let user = userCount - 1; user >= 0; user--) {
      for (let driver = driverCount - 1; driver >= 0; driver--) {
        const same = linesMatch(userLines[user], driverLines[driver]);
        lcs[user * width + driver] = same
          ? lcs[(user + 1) * width + driver + 1] + 1
          : Math.max(
              lcs[(user + 1) * width + driver],
              lcs[user * width + driver + 1],
            );
      }
    }

    const mapping = new Array<number>(driverCount).fill(-1);
    let user = 0;
    let driver = 0;

    while (user < userCount && driver < driverCount) {
      if (linesMatch(userLines[user], driverLines[driver])) {
        mapping[driver] = user;
        user++;
        driver++;
      } else if (
        lcs[(user + 1) * width + driver] >=
        lcs[user * width + driver + 1]
      ) {
        user++;
      } else {
        driver++;
      }
    }

    return new ShaderLineMap(mapping, userCount);
  }

  /** Returns a 1-based editor line, or null when nothing sensible matches. */
  toUserLine(driverLine: number): number | null {
    if (!Number.isFinite(driverLine) || driverLine < 1) return null;

    const index = Math.floor(driverLine) - 1;
    const direct = this.userIndexByDriverLine[index];
    if (direct !== undefined && direct >= 0) return direct + 1;

    // The driver may point at a line Babylon injected. Fall back to the
    // nearest driver line that we could confidently map back to the editor.
    for (
      let distance = 1;
      distance < this.userIndexByDriverLine.length;
      distance++
    ) {
      const before = index - distance;
      if (before >= 0 && this.userIndexByDriverLine[before] >= 0) {
        return this.userIndexByDriverLine[before] + 1;
      }

      const after = index + distance;
      if (
        after < this.userIndexByDriverLine.length &&
        this.userIndexByDriverLine[after] >= 0
      ) {
        return this.userIndexByDriverLine[after] + 1;
      }
    }

    return this.userLineCount > 0
      ? clamp(driverLine, 1, this.userLineCount)
      : null;
  }
}

function splitLines(value: string): string[] {
  return value.replace(/\r/g, '').split('\n');
}

function linesMatch(userLine: string, driverLine: string): boolean {
  return userLine.length > 0 && userLine === driverLine;
}

/**
 * GLSL ES 1.00 is rewritten to GLSL ES 3.00 on WebGL2. Normalising the tokens
 * that Babylon rewrites lets the diff line up user lines with driver lines.
 * Only the fragment output declarations Babylon injects are stripped: a
 * `layout(...) out` line written by the user must stay visible so errors on it
 * still map back to the editor.
 */
function normalizeShaderLine(line: string): string {
  return line
    .replace(
      /^\s*layout\s*\([^)]*\)\s*out\s+vec4\s+(?:glFragColor\d*|glFragData)\s*;\s*/gi,
      '',
    )
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
