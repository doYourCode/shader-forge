import { describe, expect, it } from 'vitest';

import {
  GBUFFER_DEBUG_MODES,
  availableDebugModes,
  debugModeValue,
  isGbufferDebugMode,
} from './screenSpaceDebug';
import { TRANSPARENT_OVERLAY_ENABLED } from './screenSpaceRender';

describe('screen-space debug modes', () => {
  it('assigns a unique numeric value to every mode', () => {
    const values = GBUFFER_DEBUG_MODES.map((mode) => mode.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values[0]).toBe(0);
  });

  it('maps ids to shader values and rejects unknown labels', () => {
    expect(debugModeValue('material')).toBe(5);
    expect(isGbufferDebugMode('depth')).toBe(true);
    expect(isGbufferDebugMode('not-a-mode')).toBe(false);
  });

  it('only offers the transparent view while an overlay renders', () => {
    const ids = availableDebugModes().map((mode) => mode.id);

    expect(ids.includes('transparent')).toBe(TRANSPARENT_OVERLAY_ENABLED);
    expect(ids).toContain('depth');
  });
});
