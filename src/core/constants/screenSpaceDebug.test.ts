import { describe, expect, it } from 'vitest';

import {
  GBUFFER_DEBUG_MODES,
  debugModeValue,
  isGbufferDebugMode,
} from './screenSpaceDebug';

describe('screen-space debug modes', () => {
  it('assigns a unique numeric value to every mode', () => {
    const values = GBUFFER_DEBUG_MODES.map((mode) => mode.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values[0]).toBe(0);
  });

  it('maps ids to shader values and rejects unknown labels', () => {
    expect(debugModeValue('material')).toBe(5);
    expect(debugModeValue('objectId')).toBe(7);
    expect(isGbufferDebugMode('depth')).toBe(true);
    expect(isGbufferDebugMode('not-a-mode')).toBe(false);
  });
});
