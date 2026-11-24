import type { AssetPickerApi } from 'assetpicker';

import {
  previewTextureCatalog,
  type TextureCatalog,
} from '@/core/constants/previewTextures';
import type {
  TexturePickRequest,
  TexturePickResult,
  TexturePickerPort,
  TexturePickerSession,
} from './TexturePicker';

import {
  buildAssetPickerConfig,
  type AssetPickerLabels,
  type AssetPickerLanguage,
} from './assetPickerConfig';
import { createAssetPickerLoader, defaultLoadApi } from './assetPickerModule';
import {
  disposedPickerSession,
  openAssetPickerSession,
} from './assetPickerSession';
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

const CANCELLED: TexturePickResult = { status: 'cancelled' };
const UNAVAILABLE: TexturePickResult = {
  status: 'rejected',
  reason: 'picker-unavailable',
};

/**
 * Adapter implementation of {@link TexturePickerPort} backed by the pinned
 * AssetPicker source package.
 *
 * The static import would inject AssetPicker's global CSS and run its demo
 * bootstrap at application start, so the module is loaded lazily on preload or
 * first open. Each open mounts an independent Vue app into the caller's host
 * and is represented by a session that owns its lifecycle.
 */
export class AssetPickerTexturePicker implements TexturePickerPort {
  private readonly labels: () => AssetPickerLabels;
  private readonly catalog: TextureCatalog;
  private readonly language: () => AssetPickerLanguage;
  private readonly load: () => Promise<AssetPickerApi | null>;
  private readonly sessions = new Set<TexturePickerSession>();
  private disposed = false;

  constructor(deps: AssetPickerTexturePickerDeps) {
    this.labels = deps.labels;
    this.catalog = deps.catalog ?? previewTextureCatalog;
    this.language = deps.language ?? (() => 'en');
    this.load = createAssetPickerLoader({
      loadApi: deps.loadApi ?? defaultLoadApi,
      register: (api) => registerRepositoryAdapter(api, this.catalog),
      isActive: () => !this.disposed,
    });
  }

  /**
   * Starts the lazy module import (and adapter registration) without opening a
   * picker. This is what keeps the first click cheap: pointer/focus handlers
   * can warm the graph while the user is still moving to the button.
   */
  preload(): void {
    if (this.disposed) return;
    void this.load();
  }

  open(request: TexturePickRequest, host: HTMLElement): TexturePickerSession {
    if (this.disposed) return disposedPickerSession(UNAVAILABLE);

    const session = openAssetPickerSession<TexturePickResult>({
      host,
      config: buildAssetPickerConfig(request, this.labels(), this.language()),
      loadApi: this.load,
      cancelled: CANCELLED,
      unavailable: UNAVAILABLE,
      mapItem: (item) =>
        mapAssetPickerItem(item, request.sampler, this.catalog),
    });

    this.sessions.add(session);
    void session.result.then(() => this.sessions.delete(session));
    return session;
  }

  /** Disposes every open picker; the view calls this when it unmounts. */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    for (const session of [...this.sessions]) session.dispose();
    this.sessions.clear();
  }
}
