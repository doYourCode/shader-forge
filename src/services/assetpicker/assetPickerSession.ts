import type { App } from 'vue';
import type {
  AssetPickerApi,
  AssetPickerConfig,
  AssetPickerItem,
} from 'assetpicker';

/**
 * The lifecycle every picker port exposes. Cancellation, rejection and
 * disposal all settle `result`; `ready` only reports whether a picker ever
 * mounted, so callers can always stop a loading state.
 */
export interface PickerSession<TResult> {
  readonly result: Promise<TResult>;
  readonly ready: Promise<void>;
  dispose(): void;
}

export interface AssetPickerSessionOptions<TResult> {
  /** Element AssetPicker mounts its Vue app into. */
  readonly host: HTMLElement;
  /** Picker configuration built for this session. */
  readonly config: AssetPickerConfig;
  /** Loads the module (and registers adapters); resolves `null` when unavailable. */
  readonly loadApi: () => Promise<AssetPickerApi | null>;
  /** Outcome when the user dismisses the picker or it is disposed. */
  readonly cancelled: TResult;
  /** Outcome when the module cannot load or the app cannot mount. */
  readonly unavailable: TResult;
  /** Projects the picked AssetPicker item onto the caller's result type. */
  readonly mapItem: (item: AssetPickerItem) => TResult;
}

/**
 * Mounts one independent AssetPicker app in `host` and represents its
 * lifecycle. This is the shared half of both picker services: it owns the
 * settle-once guarantee, the unmount-on-settle rule and the defensive mount
 * handling, while the caller owns config and item mapping.
 */
export function openAssetPickerSession<TResult>(
  options: AssetPickerSessionOptions<TResult>,
): PickerSession<TResult> {
  let settle!: (result: TResult) => void;
  const result = new Promise<TResult>((resolve) => {
    settle = resolve;
  });

  let markReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  let app: App | null = null;
  let settled = false;

  const complete = (outcome: TResult): void => {
    if (settled) return;
    settled = true;

    const mounted = app;
    app = null;
    mounted?.unmount();

    // A failed or disposed session must also release the loading state.
    markReady();
    settle(outcome);
  };

  const session: PickerSession<TResult> = {
    result,
    ready,
    dispose: () => complete(options.cancelled),
  };

  void options
    .loadApi()
    .then((api) => {
      // The user may have disposed the session while the module was loading;
      // never mount in that case.
      if (settled) return;

      if (!api) {
        complete(options.unavailable);
        return;
      }

      let finishHandled = false;

      const onFinish = (
        picked: AssetPickerItem | readonly AssetPickerItem[] | null,
        cancelled: boolean,
      ): void => {
        if (finishHandled) return;
        finishHandled = true;

        if (cancelled || picked === null) {
          complete(options.cancelled);
          return;
        }

        const item = Array.isArray(picked) ? picked[0] : picked;
        if (!item) {
          complete(options.cancelled);
          return;
        }

        complete(options.mapItem(item));
      };

      try {
        app = api.createAssetPickerApp({
          el: options.host,
          config: options.config,
          onFinish,
        });
      } catch {
        complete(options.unavailable);
        return;
      }

      markReady();

      // Defensive: if a pathological implementation fired onFinish during
      // mount, the app was not available to `complete` yet.
      if (settled) {
        app?.unmount();
        app = null;
      }
    })
    .catch(() => {
      complete(options.unavailable);
    });

  return session;
}

/** Session returned once the owning service is disposed. */
export function disposedPickerSession<TResult>(
  unavailable: TResult,
): PickerSession<TResult> {
  return {
    result: Promise.resolve(unavailable),
    ready: Promise.resolve(),
    dispose: () => undefined,
  };
}
