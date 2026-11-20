/**
 * Diagnostic metadata for the user-data block the codegen injects into a
 * stage. These types live with the other models so the model layer never has
 * to reach into `core/shader`; the codegen fills them in.
 */

/** 1-based, inclusive range of the injected block inside a stage source. */
export interface InjectedBlockRange {
  readonly startLine: number;
  readonly endLine: number;
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
