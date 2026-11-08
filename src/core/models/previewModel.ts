/** A GLB asset that can be previewed in the scene viewer. */
export interface PreviewModel {
  /** Stable identifier used by the viewer selection. */
  id: string;
  /** Human-readable name shown in the Models fieldset. */
  label: string;
  /** Bundled asset URL. */
  url: string;
}
