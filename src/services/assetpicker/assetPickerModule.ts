import type { AssetPickerApi } from 'assetpicker';

/**
 * Loads the AssetPicker module lazily. The package has no type declarations,
 * so the ambient declaration describes named exports while some resolver
 * configurations wrap dynamic imports in a synthetic `default`; accept both
 * and reject anything that does not expose the three functions we call.
 */
export async function defaultLoadApi(): Promise<AssetPickerApi> {
  const loaded: unknown = await import('assetpicker');
  if (isAssetPickerApi(loaded)) return loaded;

  const wrapped = (loaded as { readonly default?: unknown }).default;
  if (isAssetPickerApi(wrapped)) return wrapped;

  throw new Error('Unsupported AssetPicker module shape.');
}

export function isAssetPickerApi(value: unknown): value is AssetPickerApi {
  if (typeof value !== 'object' || value === null) return false;

  const api = value as Partial<Record<keyof AssetPickerApi, unknown>>;
  return (
    typeof api.createAssetPickerApp === 'function' &&
    typeof api.registerAdapter === 'function' &&
    typeof api.createItem === 'function'
  );
}

export interface AssetPickerLoaderOptions {
  /** Injectable dynamic loader; production keeps the default import. */
  readonly loadApi: () => Promise<AssetPickerApi>;
  /** Registers the adapters this picker configures, once per loaded module. */
  readonly register: (api: AssetPickerApi) => void;
  /**
   * False once the owning picker is disposed. A module that finishes loading
   * afterwards resolves `null` instead of registering adapters for a picker
   * that can no longer mount.
   */
  readonly isActive?: () => boolean;
}

/**
 * Memoized module load plus one-time adapter registration.
 *
 * The returned function never rejects: a failed load resolves `null` and is
 * retried by the next call, which is what keeps a transient chunk failure from
 * disabling the picker for the rest of the session.
 */
export function createAssetPickerLoader({
  loadApi,
  register,
  isActive = () => true,
}: AssetPickerLoaderOptions): () => Promise<AssetPickerApi | null> {
  let modulePromise: Promise<AssetPickerApi | null> | null = null;
  let registeredApi: AssetPickerApi | null = null;

  return () => {
    if (modulePromise) return modulePromise;

    const pending = loadApi()
      .then((api) => {
        if (!isActive()) return null;

        if (registeredApi !== api) {
          register(api);
          registeredApi = api;
        }

        return api;
      })
      .catch(() => {
        modulePromise = null;
        return null;
      });

    modulePromise = pending;
    return pending;
  };
}
