import { computed, reactive, ref } from 'vue';

import type { PostEffectDocument, TonemapMode } from '@/core/models/postEffect';
import { createDefaultPostEffect } from '@/core/constants/postEffects';

export interface PostEffectStackDeps {
  /** Flush the active editor buffer before the stack is mutated. */
  readonly onBeforeEdit: () => void;
  /** Apply the output transform to the preview (no recompile needed). */
  readonly applyTonemap: (mode: TonemapMode) => void;
  /** Overrides the starter document (the screen-space editor has another ABI). */
  readonly createEffect?: (id: string, name?: string) => PostEffectDocument;
}

/**
 * Owns the view-space effect stack and the output transform: at least one
 * effect always exists so the Post effect tab always has a document to edit.
 *
 * It knows nothing about tabs, compiles or the editor: the caller supplies the
 * flush hook and requests the recompile.
 */
export function usePostEffects(deps: PostEffectStackDeps) {
  const createEffect = deps.createEffect ?? createDefaultPostEffect;
  const effects = reactive<PostEffectDocument[]>([createEffect('effect-1')]);
  const activeId = ref('effect-1');
  const tonemap = ref<TonemapMode>('none');
  let counter = 1;

  const active = computed<PostEffectDocument | null>(
    () =>
      effects.find((effect) => effect.id === activeId.value) ??
      effects[0] ??
      null,
  );

  function has(id: string): boolean {
    return effects.some((effect) => effect.id === id);
  }

  function select(id: string): boolean {
    if (!has(id)) return false;

    deps.onBeforeEdit();
    activeId.value = id;
    return true;
  }

  function add(): PostEffectDocument {
    deps.onBeforeEdit();

    counter += 1;
    const effect = createEffect(`effect-${counter}`, `Effect ${counter}`);

    effects.push(effect);
    activeId.value = effect.id;
    return effect;
  }

  function remove(id: string): boolean {
    const index = effects.findIndex((effect) => effect.id === id);
    if (index < 0) return false;

    deps.onBeforeEdit();
    effects.splice(index, 1);

    // The Post effect tab always needs a document to edit.
    if (effects.length === 0) {
      counter += 1;
      effects.push(createEffect(`effect-${counter}`, `Effect ${counter}`));
    }

    if (activeId.value === id) {
      const next = effects[Math.min(index, effects.length - 1)];
      if (next) activeId.value = next.id;
    }

    return true;
  }

  function move(id: string, offset: number): boolean {
    const index = effects.findIndex((effect) => effect.id === id);
    if (index < 0) return false;

    const target = index + offset;
    if (target < 0 || target >= effects.length) return false;

    const [effect] = effects.splice(index, 1);
    if (!effect) return false;

    effects.splice(target, 0, effect);
    return true;
  }

  function setEnabled(id: string, enabled: boolean): boolean {
    const effect = effects.find((candidate) => candidate.id === id);
    if (!effect || effect.enabled === enabled) return false;

    effect.enabled = enabled;
    return true;
  }

  /**
   * Replaces the active effect with a bundled example (or an inline deep link).
   * The caller owns the recompile: this function only edits the document.
   */
  function loadIntoActive(fragment: string, name: string): boolean {
    const effect = active.value;
    if (!effect || fragment.trim().length === 0) return false;

    deps.onBeforeEdit();
    effect.fragment = fragment;
    effect.name = name;
    effect.enabled = true;
    return true;
  }

  function setTonemap(mode: TonemapMode): void {
    tonemap.value = mode;
    deps.applyTonemap(mode);
  }

  return {
    effects,
    activeId,
    active,
    tonemap,
    has,
    select,
    add,
    remove,
    move,
    setEnabled,
    loadIntoActive,
    setTonemap,
  };
}
