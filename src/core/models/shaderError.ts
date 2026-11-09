/**
 * `user_data` is used for diagnostics whose driver line falls inside the
 * generated user-data block. Those errors belong to a table row, not to an
 * editor line.
 */
export type ShaderErrorStage = 'vertex' | 'fragment' | 'program' | 'user_data';

/**
 * Broad category of a shader failure.
 *
 * - `syntax`   – the compiler could not parse the source.
 * - `type`     – the source parsed, but an expression has incompatible types.
 * - `logic`    – the source parsed, but a name/statement is used incorrectly.
 * - `link`     – both stages compiled, but the program could not be linked.
 * - `program`  – no stage-specific log was available (generic program error).
 * - `timeout`  – Babylon never reported a compile result in time.
 * - `internal` – ShaderForge/Babylon failed before reaching the driver.
 */
export type ShaderErrorKind =
  | 'syntax'
  | 'type'
  | 'logic'
  | 'link'
  | 'program'
  | 'timeout'
  | 'internal';

export interface ShaderError {
  stage: ShaderErrorStage;
  /** 1-based line in the user's editor document, or null when not applicable. */
  line: number | null;
  /** 1-based column reported by the driver, or null when not available. */
  column: number | null;
  kind: ShaderErrorKind;
  /** Short, plain-English summary of what went wrong. */
  title: string;
  /** Verbatim message reported by the GLSL compiler. */
  message: string;
  /** Actionable suggestion, or null when there is no specific advice. */
  advice: string | null;
  /**
   * Index of the offending row in the user-data table when the error was
   * attributed to the generated block; absent otherwise.
   */
  row?: number | null;
}
