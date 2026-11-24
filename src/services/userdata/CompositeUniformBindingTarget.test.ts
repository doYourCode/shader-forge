import { describe, expect, it, vi } from 'vitest';

import type { UniformBindingTarget } from './UniformBinding';
import { CompositeUniformBindingTarget } from './CompositeUniformBindingTarget';

function createTarget() {
  const target: UniformBindingTarget<string> = {
    setFloat: vi.fn(),
    setInt: vi.fn(),
    setVector2: vi.fn(),
    setVector3: vi.fn(),
    setVector4: vi.fn(),
    setColor3: vi.fn(),
    setColor4: vi.fn(),
    setTexture: vi.fn(),
  };
  return target;
}

describe('CompositeUniformBindingTarget', () => {
  it('fans every setter out to all program targets', () => {
    const first = createTarget();
    const second = createTarget();
    const composite = new CompositeUniformBindingTarget([first, second]);

    composite.setFloat('scale', 2);
    composite.setVector3('tint', { x: 1, y: 2, z: 3 });
    composite.setTexture('albedo', 'texture');

    for (const target of [first, second]) {
      expect(target.setFloat).toHaveBeenCalledWith('scale', 2);
      expect(target.setVector3).toHaveBeenCalledWith('tint', {
        x: 1,
        y: 2,
        z: 3,
      });
      expect(target.setTexture).toHaveBeenCalledWith('albedo', 'texture');
    }
  });
});
