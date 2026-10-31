import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  watch,
  type Ref,
} from 'vue';

import { mermaidService } from '@/services/mermaid/MermaidService';

/**
 * Hydrates Mermaid placeholders inside `target` after Vue has written the
 * rendered markdown into the DOM.
 *
 * Runs on mount and whenever `source` changes (slug or locale switch). A
 * generation counter abandons render passes superseded by newer content, so a
 * slow diagram can never overwrite the document currently on screen.
 */
export function useMermaid(
  target: Ref<HTMLElement | null>,
  source: () => unknown,
): void {
  let generation = 0;

  const render = async (): Promise<void> => {
    const current = ++generation;

    // Let the v-html patch that accompanies a source change land first.
    await nextTick();

    const root = target.value;
    if (!root || current !== generation) return;

    await mermaidService.renderAll(root);
  };

  onMounted(() => {
    void render();
  });

  watch(
    source,
    () => {
      void render();
    },
    { flush: 'post' },
  );

  onBeforeUnmount(() => {
    generation += 1;
  });
}
