/** An HDRI environment map that can be previewed in the scene viewer. */
export interface PreviewHdri {
  /** Stable identifier used by the viewer selection. */
  id: string;
  /** Human-readable name shown in the HDRI fieldset. */
  label: string;
  /** Bundled asset URL. */
  url: string;
}
