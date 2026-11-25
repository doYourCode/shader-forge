/**
 * Render policy shared by the screen-space pipeline and its UI.
 *
 * It lives in `core` so the asset split, the Babylon pipeline and the debug
 * panel agree on one value without the UI importing the renderer.
 */

/**
 * Whether the transparent/transmissive subset renders into its own overlay
 * target.
 *
 * Disabled: those surfaces join the main camera pass instead, which removes a
 * full-resolution HDR target, its depth buffer and its clear. Refraction is
 * disabled either way (the overlay had no scene-colour target to refract), so
 * the transmission materials already composite as opaque and the visible result
 * is unchanged. Re-enable this flag to bring the separate pass back.
 */
export const TRANSPARENT_OVERLAY_ENABLED = false;

/** Direct sun intensity the preview starts with. */
export const DEFAULT_SUN_INTENSITY = 2;

/** Environment (HDRI) intensity the preview starts with. */
export const DEFAULT_ENVIRONMENT_INTENSITY = 0.6;

/** Bounds of one intensity slider. */
export interface LightingIntensityLimits {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export const SUN_INTENSITY_LIMITS: LightingIntensityLimits = {
  min: 0,
  max: 5,
  step: 0.05,
};

export const ENVIRONMENT_INTENSITY_LIMITS: LightingIntensityLimits = {
  min: 0,
  max: 3,
  step: 0.05,
};
