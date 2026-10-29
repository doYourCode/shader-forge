import type { ShaderError, ShaderErrorStage } from '@/core/models/shaderError';
import { describeGlslIssue } from './glslDiagnostics';
import { isGlslStackFrame, parseGlslInfoLog } from './glslLogParser';
import { ShaderLineMap } from './shaderLineMap';

export interface ShaderSourcePair {
  vertex: string;
  fragment: string;
}

/**
 * One raw info log captured while a shader/program was compiled.
 * `source` is the exact text handed to `gl.shaderSource`, when available; it
 * is required to translate driver line numbers back to editor lines.
 */
export interface ShaderCompileRecord {
  stage: ShaderErrorStage;
  log: string;
  source: string | null;
}

const MAX_ERRORS = 20;

/**
 * Turns the raw GLSL info logs reported by the driver into editor-friendly
 * diagnostics: mapped line/column, a category, and plain-English advice.
 *
 * `fallbackLog` is the string Babylon handed to `onError`. It is only used
 * when no raw GL log could be captured (for example a context-loss error).
 */
export function parseShaderCompileErrors(
  records: readonly ShaderCompileRecord[],
  source: ShaderSourcePair,
  fallbackLog = '',
): ShaderError[] {
  const errors: ShaderError[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    const diagnostics = parseGlslInfoLog(record.log).filter(
      (diagnostic) => diagnostic.severity === 'error',
    );
    const lineMap = createLineMap(record, source);

    for (const diagnostic of diagnostics) {
      const line =
        diagnostic.driverLine !== null && lineMap
          ? lineMap.toUserLine(diagnostic.driverLine)
          : null;
      const column = line === null ? null : diagnostic.column;
      const description = describeGlslIssue(diagnostic.message);
      const key = `${record.stage}:${line}:${column}:${diagnostic.message.toLowerCase()}`;

      if (seen.has(key)) continue;
      seen.add(key);

      errors.push({
        stage: record.stage,
        line,
        column,
        kind: description.kind,
        title: description.title,
        message: diagnostic.message,
        advice: description.advice,
      });

      if (errors.length >= MAX_ERRORS) return errors;
    }
  }

  if (errors.length === 0) {
    errors.push(createFallbackError(records, fallbackLog));
  }

  return errors;
}

function createLineMap(
  record: ShaderCompileRecord,
  source: ShaderSourcePair,
): ShaderLineMap | null {
  if (!record.source) return null;
  if (record.stage === 'vertex') {
    return ShaderLineMap.between(record.source, source.vertex);
  }
  if (record.stage === 'fragment') {
    return ShaderLineMap.between(record.source, source.fragment);
  }
  return null;
}

/**
 * Last-resort diagnostic for cases where the GL boundary did not report a
 * shader/program log at all (context loss, driver crash, async preparation
 * failure). It still strips Babylon's JavaScript stack so the UI never shows
 * internal frames as if they were GLSL messages.
 */
function createFallbackError(
  records: readonly ShaderCompileRecord[],
  fallbackLog: string,
): ShaderError {
  const stage = records[0]?.stage ?? detectStage(fallbackLog);
  const message =
    extractFallbackMessage(fallbackLog) ??
    'The shader could not be compiled and the driver returned no message.';
  const description = describeGlslIssue(message);
  const isProgram = stage === 'program';

  return {
    stage,
    line: null,
    column: null,
    kind:
      isProgram && description.kind === 'program' ? 'link' : description.kind,
    title:
      isProgram && description.kind === 'program'
        ? 'Shader program failed to link'
        : description.title,
    message,
    advice: isProgram
      ? 'The vertex and fragment stages compiled separately but could not be linked. Make sure every varying has the same name and type in both shaders.'
      : description.advice,
  };
}

function extractFallbackMessage(raw: string): string | null {
  const normalized = normalizeFallbackLog(raw);
  const firstDiagnostic = parseGlslInfoLog(normalized).find(
    (diagnostic) => diagnostic.severity === 'error',
  );
  if (firstDiagnostic) return firstDiagnostic.message;

  return firstUsefulLine(normalized);
}

/**
 * Babylon prefixes driver messages with `VERTEX SHADER` / `FRAGMENT SHADER`
 * and stores `error.stack` instead of `error.message`. Normalising those
 * markers lets the same parser read the fallback text.
 */
function normalizeFallbackLog(raw: string): string {
  return raw
    .replace(/\b(VERTEX|FRAGMENT)\s+SHADER\s+(ERROR|WARNING)\b/gi, '$2')
    .replace(/^[ \t]*Error:\s*/gm, '');
}

function detectStage(raw: string): ShaderErrorStage {
  if (/\bVERTEX\s+SHADER\b/i.test(raw)) return 'vertex';
  if (/\bFRAGMENT\s+SHADER\b/i.test(raw)) return 'fragment';
  return 'program';
}

function firstUsefulLine(raw: string): string | null {
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (isGlslStackFrame(line)) continue;

    const cleaned = line
      .replace(/^(VERTEX|FRAGMENT)\s+SHADER\s+/i, '')
      .replace(/^(ERROR|WARNING):\s*/i, '')
      .trim();

    if (
      cleaned &&
      !/^shader (?:compilation failed|program failed to link)\.?$/i.test(cleaned)
    ) {
      return cleaned;
    }
  }

  return null;
}
