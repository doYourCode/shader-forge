import en from '@/i18n/locales/en.json';

/**
 * Locale key for an asset label.
 *
 * The convention lives here so the catalogs (which must not carry label
 * literals) and the UI (which translates them) cannot disagree about it.
 */
export function assetLabelKey(plural: string, id: string): string {
  return `assets.${plural}.${id}`;
}

/**
 * English label for an asset id, read from the authored locale file.
 *
 * Catalogs still expose `label` because `PreviewModel`, `PreviewHdri` and
 * `PreviewTexture` promise it, and non-i18n consumers such as the AssetPicker
 * adapter render it directly. i18n-aware UI should call {@link assetLabelKey}
 * and translate the key instead.
 */
export function assetLabel(plural: string, id: string): string {
  const key = assetLabelKey(plural, id);
  const value = readMessage(en, key);

  if (typeof value !== 'string') {
    throw new Error(`Missing English asset label "${key}" in en.json.`);
  }

  return value;
}

/** Walks a dot-separated key without assuming the locale tree's shape. */
function readMessage(
  messages: Readonly<Record<string, unknown>>,
  key: string,
): unknown {
  let node: unknown = messages;

  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Readonly<Record<string, unknown>>)[segment];
  }

  return node;
}
