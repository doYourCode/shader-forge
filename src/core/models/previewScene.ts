/** A bundled GLB scene the Screen Space editor can render. */
export interface PreviewScene {
  /** Stable identifier used by the scene selection. */
  id: string;
  /** Human-readable name shown in the scene picker. */
  label: string;
  /** Bundled asset URL. */
  url: string;
  /** Optional short description shown in the picker. */
  description?: string;
}
