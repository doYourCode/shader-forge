import type { PostProcess } from '@babylonjs/core';

/**
 * Sampler names the linked programs actually kept.
 *
 * Babylon prunes declared-but-inactive samplers from `Effect.getSamplers()`
 * (the driver only reports uniforms the program uses), so this is the precise
 * set of textures a pass reads. Unlike text matching it is not fooled by the
 * ABI's full declarations or by helper functions the shader never calls.
 *
 * The answer is conservative in the safe direction: a driver that keeps an
 * unused sampler makes the set larger, which only costs a target nothing reads.
 * A used sampler is never pruned.
 */
export function activeSamplers(
  passes: readonly Pick<PostProcess, 'getEffect'>[],
): ReadonlySet<string> {
  const names = new Set<string>();

  for (const pass of passes) {
    for (const name of pass.getEffect()?.getSamplers() ?? []) {
      // Array samplers report `name[0]`; the ABIs only declare scalars, but a
      // user may still index an array and the binding is the same texture.
      names.add(name.replace(/\[0\]$/, ''));
    }
  }

  return names;
}
