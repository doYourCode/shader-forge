/**
 * How a bundled preview environment is stored, which decides how it is loaded.
 *
 * - `env`: Babylon's prefiltered cubemap container. Radiance mips and the
 *   irradiance cubemap are baked offline, so loading it needs no GPU filtering.
 * - `hdr`: a raw RGBE panorama. Kept as a fallback because it needs the
 *   runtime decode + IBL filter (see `IblFiltering`).
 */
export type PreviewHdriFormat = 'env' | 'hdr';

/** An HDRI environment map that can be previewed in the scene viewer. */
export interface PreviewHdri {
  /** Stable identifier used by the viewer selection. */
  readonly id: string;
  /** Human-readable name shown in the environment picker. */
  readonly label: string;
  /** Bundled asset URL. */
  readonly url: string;
  /**
   * Small preview (Vite build-time URL) shown beside the label in the picker.
   * Catalogs provide one; the picker falls back to a label-only entry.
   */
  readonly thumbnailUrl?: string;
  /** Storage format, which selects the loader and the load-time work. */
  readonly format: PreviewHdriFormat;
}
