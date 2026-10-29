export type GlslLogSeverity = 'error' | 'warning';

export interface GlslLogDiagnostic {
  /** 1-based line in the source handed to the driver, when the log has one. */
  driverLine: number | null;
  /** 1-based column, when the driver reports one. */
  column: number | null;
  severity: GlslLogSeverity;
  /** Driver message with location/severity prefixes removed. */
  message: string;
}

const MAX_DIAGNOSTICS = 25;

/**
 * Lines that drivers append to the real diagnostics. They add no information
 * and would otherwise show up as extra "errors" in the UI.
 */
const NOISE_PATTERNS: readonly RegExp[] = [
  /^\d+\s+compilation errors?\b/i,
  /no code generated/i,
  /^compilation terminated\.?$/i,
  /^error:\s*$/i,
  /^warning:\s*$/i,
  /^shader compilation failed\.?$/i,
  /^shader program failed to link\.?$/i,
];

/**
 * Parses the raw string returned by `gl.getShaderInfoLog()` (and program
 * info logs) into structured diagnostics.
 *
 * WebGL does not standardise the info-log format, so this understands the
 * formats used by ANGLE/Chrome, Firefox, Mesa and NVIDIA:
 *
 *   ERROR: 0:12: 'foo' : syntax error          (ANGLE / Firefox)
 *   ERROR: 0:12:4: 'foo' : syntax error        (ANGLE with column)
 *   0:12(4): error: `foo' undeclared           (Mesa)
 *   0(12) : error C0000: syntax error, ...     (NVIDIA)
 *
 * Lines without a location are returned only when the log has no located
 * diagnostics at all (for example a program link failure).
 */
export function parseGlslInfoLog(rawLog: string): GlslLogDiagnostic[] {
  const located: GlslLogDiagnostic[] = [];
  const unlocated: GlslLogDiagnostic[] = [];

  for (const rawLine of rawLog.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trim();
    if (!line || isGlslStackFrame(line)) continue;

    const diagnostic = parseLogLine(line);
    if (!diagnostic) continue;

    const bucket = diagnostic.driverLine === null ? unlocated : located;
    bucket.push(diagnostic);
  }

  const diagnostics = dedupe(located).slice(0, MAX_DIAGNOSTICS);
  if (diagnostics.length > 0) return diagnostics;

  return dedupe(unlocated).slice(0, MAX_DIAGNOSTICS);
}

function parseLogLine(line: string): GlslLogDiagnostic | null {
  // ANGLE, Firefox and most WebGL implementations:
  //   ERROR: 0:12: 'foo' : syntax error
  //   ERROR: 0:12:4: 'foo' : syntax error
  const located = /^(ERROR|WARNING):\s*\d+:(\d+)(?::(\d+))?:\s*(.+)$/i.exec(
    line,
  );
  if (located) {
    return createDiagnostic(
      located[2],
      located[3] ?? null,
      located[1],
      located[4],
    );
  }

  // Mesa:
  //   0:12(4): error: `foo' undeclared
  const mesa = /^\d+:(\d+)\((\d+)\):\s*(error|warning)\s*:?\s*(.+)$/i.exec(
    line,
  );
  if (mesa) {
    return createDiagnostic(mesa[1], mesa[2], mesa[3], mesa[4]);
  }

  // NVIDIA:
  //   0(12) : error C0000: syntax error, unexpected ...
  const nvidia =
    /^\d+\((\d+)\)\s*:\s*(error|warning)\s*[A-Z]?\d*\s*:\s*(.+)$/i.exec(line);
  if (nvidia) {
    return createDiagnostic(nvidia[1], null, nvidia[2], nvidia[3]);
  }

  // Location-less logs, typically program link/validation errors.
  const unlocated = /^(ERROR|WARNING):\s*(.+)$/i.exec(line);
  if (unlocated) {
    return createDiagnostic(null, null, unlocated[1], unlocated[2]);
  }

  return null;
}

function createDiagnostic(
  driverLine: string | null,
  column: string | null,
  severity: string,
  message: string,
): GlslLogDiagnostic | null {
  const cleanMessage = message.replace(/\s+/g, ' ').trim();
  if (!cleanMessage || isNoise(cleanMessage)) return null;

  return {
    driverLine: driverLine === null ? null : parsePositiveInt(driverLine),
    column: column === null ? null : parsePositiveInt(column),
    severity: severity.toLowerCase() === 'warning' ? 'warning' : 'error',
    message: cleanMessage,
  };
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isNoise(message: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Babylon turns the driver log into a JavaScript stack trace before handing it
 * to `onError`. Stack frames must never be presented as shader errors.
 */
export function isGlslStackFrame(line: string): boolean {
  return (
    /^at\s/.test(line) ||
    /^(?:[^\s@]*@)?(?:https?|blob|moz-extension):/.test(line) ||
    /^\w+@[\w.-]+:\d+:\d+$/.test(line) ||
    line.includes('node_modules/') ||
    line.includes('.vite/deps/')
  );
}

function dedupe(diagnostics: readonly GlslLogDiagnostic[]): GlslLogDiagnostic[] {
  const seen = new Set<string>();
  const result: GlslLogDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.driverLine}:${diagnostic.column}:${diagnostic.severity}:${diagnostic.message.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(diagnostic);
  }

  return result;
}
