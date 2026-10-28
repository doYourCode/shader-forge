export type ShaderErrorStage = 'vertex' | 'fragment' | 'program';

export interface ShaderError {
  stage: ShaderErrorStage;
  /** 1-based line in the user's editor document, or null when not applicable. */
  line: number | null;
  column: number | null;
  message: string;
}
