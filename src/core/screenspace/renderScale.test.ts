import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RENDER_SCALE_POLICY,
  FRAME_TIME_EMA_ALPHA,
  blendFrameTime,
  hardwareScalingLevel,
  nextRenderScale,
} from './renderScale';

const budget = DEFAULT_RENDER_SCALE_POLICY.targetFrameMs;

describe('nextRenderScale', () => {
  it('keeps full resolution inside the hysteresis band', () => {
    expect(nextRenderScale(1, budget)).toBe(1);
    expect(nextRenderScale(0.8, budget * 1.1)).toBe(0.8);
  });

  it('steps down when the frame misses the budget', () => {
    expect(nextRenderScale(1, budget * 1.5)).toBe(0.9);
    expect(nextRenderScale(0.9, budget * 2)).toBe(0.8);
  });

  it('never drops below the configured floor', () => {
    expect(nextRenderScale(0.5, budget * 10)).toBe(0.5);
  });

  it('recovers only with real headroom', () => {
    expect(nextRenderScale(0.8, budget * 0.5)).toBe(0.85);
    expect(nextRenderScale(1, budget * 0.5)).toBe(1);
  });

  it('does not oscillate between adjacent scales', () => {
    const down = nextRenderScale(0.9, budget * 1.3);
    const up = nextRenderScale(down, budget * 0.9);

    expect(up).toBe(down);
  });

  it('ignores a missing frame time', () => {
    expect(nextRenderScale(0.75, Number.NaN)).toBe(0.75);
    expect(nextRenderScale(0.75, 0)).toBe(0.75);
  });
});

describe('blendFrameTime', () => {
  it('moves the average towards the sample', () => {
    expect(blendFrameTime(16, 32)).toBeCloseTo(16 + 16 * FRAME_TIME_EMA_ALPHA);
  });

  it('seeds the average from the first valid sample', () => {
    expect(blendFrameTime(0, 33)).toBe(33);
    expect(blendFrameTime(16, Number.NaN)).toBe(16);
  });
});

describe('hardwareScalingLevel', () => {
  it('renders fewer pixels for a scale below one', () => {
    expect(hardwareScalingLevel(0.5)).toBe(2);
    expect(hardwareScalingLevel(1)).toBe(1);
  });
});
