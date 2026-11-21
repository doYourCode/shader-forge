// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { landingCards } from './landingCards';
import { router } from '@/router';

describe('landing cards', () => {
  it('keeps the four primary destinations available', () => {
    expect(landingCards).toHaveLength(4);

    for (const card of landingCards) {
      expect(card.enabled).toBe(true);
      expect(card.to).toBeDefined();
    }
  });

  it('points every card at a real route, never the catch-all redirect', () => {
    for (const card of landingCards) {
      const target = card.to;
      if (!target) throw new Error(`${card.id} has no destination`);

      const resolved = router.resolve(target);
      expect(resolved.matched.length).toBeGreaterThan(0);
      expect(resolved.name).not.toBe('landing');
    }
  });
});
