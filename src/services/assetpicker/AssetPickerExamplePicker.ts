import type { AssetPickerApi } from 'assetpicker';

import {
  shaderExampleCatalog,
  type ShaderExampleCatalog,
} from '@/core/constants/shaderExamples';
import type {
  ExamplePickResult,
  ExamplePickerPort,
  ExamplePickerSession,
} from '@/services/examplepicker/ExamplePicker';

import type { AssetPickerLanguage } from './assetPickerConfig';
import { registerExampleAdapter } from './exampleAdapter';
import {
  buildExamplePickerConfig,
  type ExamplePickerLabels,
} from './examplePickerConfig';
import { createAssetPickerLoader, defaultLoadApi } from './assetPickerModule';
import {
  disposedPickerSession,
  openAssetPickerSession,
} from './assetPickerSession';
import { mapAssetPickerExample } from './mapAssetPickerExample';

export interface AssetPickerExamplePickerDeps {
  /** Translated labels; required so the service owns no UI strings. */
  readonly labels: () => ExamplePickerLabels;
  /** Injectable dynamic loader; production keeps the default import. */
  readonly loadApi?: () => Promise<AssetPickerApi>;
  readonly catalog?: ShaderExampleCatalog;
  readonly language?: () => AssetPickerLanguage;
}

const CANCELLED: ExamplePickResult = { status: 'cancelled' };
const UNAVAILABLE: ExamplePickResult = {
  status: 'rejected',
  reason: 'picker-unavailable',
};

/**
 * Adapter implementation of {@link ExamplePickerPort} backed by the pinned
 * AssetPicker source package.
 *
 * The module is loaded lazily so its CSS and bootstrap stay out of the editor's
 * cold path. Each open mounts an independent Vue app into the caller's host
 * and is represented by a session that owns its lifecycle.
 */
export class AssetPickerExamplePicker implements ExamplePickerPort {
  private readonly labels: () => ExamplePickerLabels;
  private readonly catalog: ShaderExampleCatalog;
  private readonly language: () => AssetPickerLanguage;
  private readonly load: () => Promise<AssetPickerApi | null>;
  private readonly sessions = new Set<ExamplePickerSession>();
  private disposed = false;

  constructor(deps: AssetPickerExamplePickerDeps) {
    this.labels = deps.labels;
    this.catalog = deps.catalog ?? shaderExampleCatalog;
    this.language = deps.language ?? (() => 'en');
    this.load = createAssetPickerLoader({
      loadApi: deps.loadApi ?? defaultLoadApi,
      register: (api) => registerExampleAdapter(api, this.catalog),
      isActive: () => !this.disposed,
    });
  }

  /**
   * Starts the lazy module import (and adapter registration) without opening a
   * picker, so the first click does not pay for the chunk download.
   */
  preload(): void {
    if (this.disposed) return;
    void this.load();
  }

  open(host: HTMLElement): ExamplePickerSession {
    if (this.disposed) return disposedPickerSession(UNAVAILABLE);

    const session = openAssetPickerSession<ExamplePickResult>({
      host,
      config: buildExamplePickerConfig(this.labels(), this.language()),
      loadApi: this.load,
      cancelled: CANCELLED,
      unavailable: UNAVAILABLE,
      mapItem: (item) => mapAssetPickerExample(item, this.catalog),
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
