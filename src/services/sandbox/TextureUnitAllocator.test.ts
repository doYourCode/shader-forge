import { describe, expect, it } from 'vitest';

import { TextureUnitAllocator } from './TextureUnitAllocator';

describe('TextureUnitAllocator', () => {
  it('keeps a name on the same unit and reserves the first units', () => {
    const units = new TextureUnitAllocator(3);

    expect(units.unitFor('albedo')).toBe(3);
    expect(units.unitFor('albedo')).toBe(3);
    expect(units.unitFor('detail')).toBe(4);
  });
});
