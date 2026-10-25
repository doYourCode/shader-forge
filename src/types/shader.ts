
export type ShaderStage = 'vertex' | 'fragment' | 'program'

export interface ShaderDiagnostic {
  stage: ShaderStage
  line: number | null
  message: string
}
