import type { Effect, ShaderMaterial } from '@babylonjs/core';
import type { ShaderError, ShaderErrorStage } from '@/core/models/shaderError';
import { EffectPipelineCache } from './EffectPipelineCache';

/** The outcome of one compile attempt, plus the resources it owns. */
export class CompileAttempt {
  readonly ok: boolean;
  readonly errors: ShaderError[];
  readonly stage: ShaderErrorStage | null;
  readonly material: ShaderMaterial | null;
  readonly effect: Effect | null;

  constructor(
    ok: boolean,
    errors: ShaderError[],
    stage: ShaderErrorStage | null,
    material: ShaderMaterial | null,
    effect: Effect | null,
  ) {
    this.ok = ok;
    this.errors = errors;
    this.stage = stage;
    this.material = material;
    this.effect = effect;
  }

  /**
   * Releases the attempt's GPU resources. Failed attempts also drop the
   * cached pipeline, otherwise the broken program would be reused.
   */
  release(failed: boolean): void {
    if (failed) {
      EffectPipelineCache.evict(this.effect);
    }

    const effect = this.effect;
    const attached = this.material?.getEffect() === effect;

    this.material?.dispose();
    if (!attached) {
      effect?.dispose();
    }
  }
}
