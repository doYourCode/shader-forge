/**
 * Narrow port between the toolbar's example widget and whichever picker
 * implementation is mounted. Like the texture port, it exposes no AssetPicker
 * types: cancellation and rejection are ordinary results, not exceptions, and
 * the result promise never rejects.
 */
export type ExamplePickRejection = 'unsupported-example' | 'picker-unavailable';

export type ExamplePickResult =
  | { readonly status: 'picked'; readonly exampleId: string }
  | { readonly status: 'cancelled' }
  | { readonly status: 'rejected'; readonly reason: ExamplePickRejection };

export interface ExamplePickerSession {
  readonly result: Promise<ExamplePickResult>;
  /**
   * Settles once the picker has mounted, or once it is clear it never will
   * (unavailable module, early disposal). It never rejects: a failed mount is
   * reported through {@link result}, so callers can always use it to stop a
   * loading state.
   */
  readonly ready: Promise<void>;
  dispose(): void;
}

export interface ExamplePickerPort {
  /**
   * Warms implementation code without opening a session. Idempotent and safe
   * to call from pointer/focus handlers; failures are retried by the next
   * `open()`.
   */
  preload(): void;
  open(host: HTMLElement): ExamplePickerSession;
}
