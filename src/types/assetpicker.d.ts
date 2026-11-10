/**
 * Minimal declarations for the pinned AssetPicker source package.
 *
 * The package ships JavaScript only (no bundled declarations), and imports are
 * intentionally limited to the handful of exports ShaderForge consumes. Keep
 * this file an anti-corruption boundary: no AssetPicker type may leak into the
 * domain model or the texture registry.
 */
declare module 'assetpicker' {
  export type AssetPickerItemType = 'file' | 'dir' | 'category';

  export type AssetPickerThumbnailMode = 'url' | 'data';

  export type AssetPickerLanguage = 'auto' | 'en' | 'de';

  export interface AssetPickerItemLinks {
    readonly open?: string;
    readonly download?: string;
  }

  export interface AssetPickerItem {
    readonly id: string;
    readonly storage: string;
    readonly name: string;
    readonly type: AssetPickerItemType;
    readonly extension?: string;
    readonly thumbnail?: string;
    readonly links?: AssetPickerItemLinks;
    readonly data?: unknown;
  }

  export interface AssetPickerItemInput {
    readonly id: string;
    readonly storage: string;
    readonly name: string;
    readonly type: AssetPickerItemType;
    readonly extension?: string;
    readonly thumbnail?: string;
    readonly links?: AssetPickerItemLinks;
    readonly data?: unknown;
  }

  export interface AssetPickerPickConfig {
    readonly limit?: number;
    readonly types?: readonly AssetPickerItemType[];
    readonly extensions?: readonly string[];
  }

  export interface AssetPickerStorageConfig {
    readonly adapter: string;
    readonly label?: string;
    /** Storage-specific options (for ShaderForge: the sampler kind). */
    readonly [option: string]: unknown;
  }

  export interface AssetPickerConfig {
    readonly title?: string;
    readonly language?: AssetPickerLanguage;
    readonly pick?: AssetPickerPickConfig;
    readonly thumbnails?: AssetPickerThumbnailMode;
    readonly storages: Readonly<Record<string, AssetPickerStorageConfig>>;
  }

  export interface AssetPickerListResult {
    readonly items: AssetPickerItem[];
    readonly total: number;
  }

  export interface AssetPickerAdapter {
    readonly key?: string;
    readonly label?: string;
    list(
      item: AssetPickerItem | null,
    ): AssetPickerListResult | Promise<AssetPickerListResult>;
    search(
      word: string,
    ): AssetPickerListResult | Promise<AssetPickerListResult>;
  }

  export interface AssetPickerAdapterContext {
    readonly onLoading?: (delta: number) => void;
    readonly thumbnails?: AssetPickerThumbnailMode;
    readonly config: AssetPickerConfig;
  }

  export type AssetPickerStorage = AssetPickerStorageConfig & {
    readonly key: string;
  };

  export type AssetPickerAdapterFactory = (
    storage: AssetPickerStorage,
    context: AssetPickerAdapterContext,
  ) => AssetPickerAdapter;

  export interface AssetPickerAppOptions {
    readonly el: string | Element;
    readonly config: AssetPickerConfig;
    readonly onFinish?: (
      result: AssetPickerItem | readonly AssetPickerItem[] | null,
      cancelled: boolean,
    ) => void;
  }

  export interface AssetPickerApi {
    createAssetPickerApp(options: AssetPickerAppOptions): import('vue').App;
    registerAdapter(type: string, factory: AssetPickerAdapterFactory): void;
    createItem(
      data: AssetPickerItemInput | (() => AssetPickerItemInput),
      thumbnailMode?: AssetPickerThumbnailMode,
    ): AssetPickerItem;
  }
}
