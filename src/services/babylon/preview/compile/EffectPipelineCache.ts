import type { Effect } from '@babylonjs/core';
import { getStateObject } from '@babylonjs/core/Engines/thinEngine.functions';

/**
 * Babylon keeps compiled pipelines in a per-context state object that is not
 * part of the public engine API. When a shader fails, that cache must be
 * invalidated or the next compile reuses the broken pipeline forever.
 *
 * Fragile by nature: both `getStateObject` and the private `_gl` field are
 * Babylon internals. They are isolated here so an upgrade only has to fix this
 * file.
 */
export class EffectPipelineCache {
  private constructor() {}

  static evict(effect: Effect | null): void {
    if (!effect) return;

    const engine = effect.getEngine() as unknown as {
      _gl?: WebGL2RenderingContext;
    };
    const context = engine._gl;
    if (!context) return;

    const state = getStateObject(context);
    const pipelineName = effect.key.replace(/\r/g, '').replace(/\n/g, '|');
    const pipeline = state.cachedPipelines[pipelineName];

    if (!pipeline) return;

    pipeline.dispose();
    delete state.cachedPipelines[pipelineName];
  }
}
