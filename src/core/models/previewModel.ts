/** A GLB asset that can be previewed in the scene viewer. */
export interface PreviewModel {
  /** Stable identifier used by the viewer selection. */
  id: string;
  /** Human-readable name shown in the model picker. */
  label: string;
  /** Bundled asset URL. */
  url: string;
  /**
   * Small preview (Vite build-time URL) shown beside the label in the picker.
   * Catalogs provide one; the picker falls back to a label-only entry.
   */
  thumbnailUrl?: string;
}
