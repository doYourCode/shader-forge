import { describe, expect, it, vi } from 'vitest';

import type { PostEffectDocument } from '@/core/models/postEffect';
import { usePostEffects } from './usePostEffects';

describe('usePostEffects', () => {
  it('uses the injected factory for starter documents', () => {
    const factory = vi.fn((id: string, name?: string): PostEffectDocument => ({
      id,
      name: name ?? 'Custom',
      enabled: true,
      fragment: `// ${id}`,
    }));

    const stack = usePostEffects({
      onBeforeEdit: vi.fn(),
      applyTonemap: vi.fn(),
      createEffect: factory,
    });

    expect(stack.effects[0]?.fragment).toBe('// effect-1');
    stack.add();
    expect(stack.effects[1]?.fragment).toBe('// effect-2');
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('keeps at least one effect and reorders/toggles the stack', () => {
    const stack = usePostEffects({
      onBeforeEdit: vi.fn(),
      applyTonemap: vi.fn(),
    });
    stack.add();
    const [first, second] = stack.effects;
    expect(first && second).toBeTruthy();

    expect(stack.move(second!.id, -1)).toBe(true);
    expect(stack.effects[0]?.id).toBe(second!.id);

    expect(stack.setEnabled(first!.id, false)).toBe(true);
    expect(
      stack.effects.find((effect) => effect.id === first!.id)?.enabled,
    ).toBe(false);

    stack.remove(second!.id);
    stack.remove(first!.id);
    expect(stack.effects).toHaveLength(1);
  });
});
