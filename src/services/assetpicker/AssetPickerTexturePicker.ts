import type { App } from 'vue';
import type { AssetPickerApi, AssetPickerItem } from 'assetpicker';

import {
  previewTextureCatalog,
  type TextureCatalog,
} from '@/core/constants/previewTextures';
import type {
  TexturePickRequest,
  TexturePickResult,
  TexturePickerPort,
  TexturePickerSession,
} from '@/services/texturepicker/TexturePicker';

import {
  buildAssetPickerConfig,
  type AssetPickerLabels,
  type AssetPickerLanguage,
} from './assetPickerConfig';
import { mapAssetPickerItem } from './mapAssetPickerItem';
import { registerRepositoryAdapter } from './repositoryTextureAdapter';

export interface AssetPickerTexturePickerDeps {
  /** Translated labels; required so the service owns no UI strings. */
  readonly labels: () => AssetPickerLabels;
  /** Injectable dynamic loader; production keeps the default import. */
  readonly loadApi?: () => Promise<AssetPickerApi>;
  readonly catalog?: TextureCatalog;
  readonly language?: () => AssetPickerLanguage;
}

/**
 * Loads the AssetPicker module lazily. The package has no type declarations,
 * so the ambient declaration describes named exports while some resolver
 * configurations wrap dynamic imports in a synthetic `default`; accept both
 * and reject anything that does not expose the three functions we call.
 */
async function defaultLoadApi(): Promise<AssetPickerApi> {
  const loaded: unknown = await import('assetpicker');
  if (isAssetPickerApi(loaded)) return loaded;

  const wrapped = (loaded as { readonly default?: unknown }).default;
  if (isAssetPickerApi(wrapped)) return wrapped;

  throw new Error('Unsupported AssetPicker module shape.');
}

function isAssetPickerApi(value: unknown): value is AssetPickerApi {
  if (typeof value !== 'object' || value === null) return false;

  const api = value as Partial<Record<keyof AssetPickerApi, unknown>>;
  return (
    typeof api.createAssetPickerApp === 'function' &&
    typeof api.registerAdapter === 'function' &&
    typeof api.createItem === 'function'
  );
}

/**
 * Adapter implementation of {@link TexturePickerPort} backed by the pinned
 * AssetPicker source package.
 *
 * The static import would inject AssetPicker's global CSS and run its demo
 * bootstrap at application start, so the module is loaded lazily on the first
 * open. Each open mounts an independent Vue app into the caller's host and is
 * represented by a session that owns its lifecycle.
 */
export class AssetPickerTexturePicker implements TexturePickerPort {
  private readonly labels: () => AssetPickerLabels;
  private readonly loadApi: () => Promise<AssetPickerApi>;
  private readonly catalog: TextureCatalog;
  private readonly language: () => AssetPickerLanguage;
  private readonly sessions = new Set<TexturePickerSession>();
  private modulePromise: Promise<AssetPickerApi | null> | null = null;
  private registeredApi: AssetPickerApi | null = null;
  private disposed = false;

  constructor(deps: AssetPickerTexturePickerDeps) {
    this.labels = deps.labels;
    this.loadApi = deps.loadApi ?? defaultLoadApi;
    this.catalog = deps.catalog ?? previewTextureCatalog;
    this.language = deps.language ?? (() => 'en');
  }

  open(request: TexturePickRequest, host: HTMLElement): TexturePickerSession {
    if (this.disposed) return disposedSession();

    let settle!: (result: TexturePickResult) => void;
    const result = new Promise<TexturePickResult>((resolve) => {
      settle = resolve;
    });

    let app: App | null = null;
    let settled = false;

    const complete = (outcome: TexturePickResult): void => {
      if (settled) return;
      settled = true;

      const mounted = app;
      app = null;
      mounted?.unmount();

      this.sessions.delete(session);
      settle(outcome);
    };

    let session: TexturePickerSession;
    session = {
      result,
      dispose: () => complete({ status: 'cancelled' }),
    };
    this.sessions.add(session);

    void this.load()
      .then((api) => {
        // The user may have disposed the session (or the whole service) while
        // the module was loading; never mount in that case.
        if (settled) return;

        if (!api) {
          complete({ status: 'rejected', reason: 'picker-unavailable' });
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
            complete({ status: 'cancelled' });
            return;
          }

          const item = Array.isArray(picked) ? picked[0] : picked;
          if (!item) {
            complete({ status: 'cancelled' });
            return;
          }

          complete(mapAssetPickerItem(item, request.sampler, this.catalog));
        };

        try {
          app = api.createAssetPickerApp({
            el: host,
            config: buildAssetPickerConfig(
              request,
              this.labels(),
              this.language(),
            ),
            onFinish,
          });
        } catch {
          complete({ status: 'rejected', reason: 'picker-unavailable' });
          return;
        }

        // Defensive: if a pathological implementation fired onFinish during
        // mount, the app was not available to `complete` yet.
        if (settled) {
          app?.unmount();
          app = null;
        }
      })
      .catch(() => {
        complete({ status: 'rejected', reason: 'picker-unavailable' });
      });

    return session;
  }

  /** Disposes every open picker; the view calls this when it unmounts. */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    for (const session of [...this.sessions]) session.dispose();
    this.sessions.clear();
  }

  private load(): Promise<AssetPickerApi | null> {
    if (this.modulePromise) return this.modulePromise;

    const pending = this.loadApi()
      .then((api) => {
        if (this.disposed) return null;

        // One registration per loaded module, before any app is created.
        if (this.registeredApi !== api) {
          registerRepositoryAdapter(api, this.catalog);
          this.registeredApi = api;
        }

        return api;
      })
      .catch(() => {
        // A failed load must be retryable by a later open.
        this.modulePromise = null;
        return null;
      });

    this.modulePromise = pending;
    return pending;
  }
}

function disposedSession(): TexturePickerSession {
  return {
    result: Promise.resolve({
      status: 'rejected',
      reason: 'picker-unavailable',
    }),
    dispose: () => undefined,
  };
}
