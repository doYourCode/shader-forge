/**
 * Adaptive render-resolution policy for the screen-space preview.
 *
 * The preview is fill-bound: the scene G-buffer, the opaque colour target and
 * every effect pass scale with the pixel count. When the frame time exceeds the
 * budget the cheapest correct lever is to render fewer pixels and let the
 * browser upscale the canvas, so the policy walks a resolution scale inside
 * fixed bounds instead of dropping effects.
 *
 * The rule is deliberately asymmetric: it degrades quickly (a slow frame hurts
 * interactivity) but recovers slowly (a single fast frame is not proof that the
 * higher resolution holds). It is pure so the behaviour is testable without a
 * GPU.
 */

export interface RenderScalePolicy {
  readonly min: number;
  readonly max: number;
  /** Removed from the scale when a frame misses the budget. */
  readonly stepDown: number;
  /** Added to the scale when there is headroom. */
  readonly stepUp: number;
  readonly targetFrameMs: number;
  /** Downscale above `targetFrameMs * downThreshold`. */
  readonly downThreshold: number;
  /** Upscale below `targetFrameMs * upThreshold`. */
  readonly upThreshold: number;
}

/** 60 fps target with a 30 fps floor: the scale never goes below half. */
export const DEFAULT_RENDER_SCALE_POLICY: RenderScalePolicy = {
  min: 0.5,
  max: 1,
  stepDown: 0.1,
  stepUp: 0.05,
  targetFrameMs: 1000 / 60,
  // Below ~48 fps the preview is visibly choppy: spend resolution instead.
  downThreshold: 1.2,
  // Only raise the resolution with real headroom, so it does not oscillate.
  upThreshold: 0.75,
};

/** Smoothing factor of the frame-time average (one frame at 60 fps). */
export const FRAME_TIME_EMA_ALPHA = 0.1;

/** Exponential moving average of the frame time, in milliseconds. */
export function blendFrameTime(
  previous: number,
  sample: number,
  alpha: number = FRAME_TIME_EMA_ALPHA,
): number {
  if (!Number.isFinite(sample) || sample <= 0) return previous;
  if (!Number.isFinite(previous) || previous <= 0) return sample;

  return previous + (sample - previous) * alpha;
}

/**
 * Next scale for the measured frame time. Returns the current scale (clamped)
 * when the frame time sits inside the hysteresis band.
 */
export function nextRenderScale(
  current: number,
  averageFrameMs: number,
  policy: RenderScalePolicy = DEFAULT_RENDER_SCALE_POLICY,
): number {
  const scale = clamp(current, policy.min, policy.max);
  if (!Number.isFinite(averageFrameMs) || averageFrameMs <= 0) return scale;

  if (averageFrameMs > policy.targetFrameMs * policy.downThreshold) {
    return roundScale(clamp(scale - policy.stepDown, policy.min, policy.max));
  }

  if (averageFrameMs < policy.targetFrameMs * policy.upThreshold) {
    return roundScale(clamp(scale + policy.stepUp, policy.min, policy.max));
  }

  return scale;
}

/** Babylon renders at `1 / hardwareScalingLevel` times the canvas CSS size. */
export function hardwareScalingLevel(scale: number): number {
  return 1 / Math.max(scale, 0.01);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Two decimals keep repeated steps from drifting into 0.7000000000000001. */
function roundScale(value: number): number {
  return Math.round(value * 100) / 100;
}
