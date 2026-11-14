import { describe, expect, it } from 'vitest';

import en from '@/i18n/locales/en.json';
import ptBR from '@/i18n/locales/pt-BR.json';
import { previewHdris } from '@/core/constants/previewHdris';
import { previewModels } from '@/core/constants/previewModels';
import { previewTextures } from '@/core/constants/previewTextures';
import { assetLabel, assetLabelKey } from './labels';

const PLURALS = [
  { plural: 'models', ids: previewModels.all.map((entry) => entry.id) },
  { plural: 'hdris', ids: previewHdris.all.map((entry) => entry.id) },
  { plural: 'textures', ids: previewTextures.map((entry) => entry.id) },
] as const;

describe('assetLabelKey', () => {
  it('follows the assets.<plural>.<id> convention', () => {
    expect(assetLabelKey('models', 'monkey')).toBe('assets.models.monkey');
    expect(assetLabelKey('hdris', 'wooden-studio-17')).toBe(
      'assets.hdris.wooden-studio-17',
    );
    expect(assetLabelKey('textures', 'uv-checker-01')).toBe(
      'assets.textures.uv-checker-01',
    );
  });
});

describe('assetLabel', () => {
  it('returns the English label authored in en.json', () => {
    expect(assetLabel('models', 'monkey')).toBe('Monkey');
    expect(assetLabel('hdris', 'wooden-studio-17')).toBe('Wooden Studio 17');
    expect(assetLabel('textures', 'uv-checker-01')).toBe('UV Checker 01');
  });

  it('throws when the key is missing', () => {
    expect(() => assetLabel('models', 'does-not-exist')).toThrow(
      /assets\.models\.does-not-exist/,
    );
  });
});

describe('asset labels in the locale files', () => {
  it('has a non-empty key for every catalog id in both locales', () => {
    for (const { plural, ids } of PLURALS) {
      for (const id of ids) {
        const key = assetLabelKey(plural, id);

        expect(readMessage(en, key), `en: ${key}`).toBeTypeOf('string');
        expect(readMessage(ptBR, key), `pt-BR: ${key}`).toBeTypeOf('string');
        expect(readMessage(en, key)?.trim().length, `en: ${key}`).toBeGreaterThan(
          0,
        );
        expect(
          readMessage(ptBR, key)?.trim().length,
          `pt-BR: ${key}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('translates generic model nouns while keeping proper asset names', () => {
    expect(readMessage(ptBR, 'assets.models.monkey')).toBe('Macaco');
    expect(readMessage(ptBR, 'assets.models.sphere')).toBe('Esfera');
    expect(readMessage(ptBR, 'assets.models.cube')).toBe('Cubo');
    expect(readMessage(ptBR, 'assets.models.bunny')).toBe('Coelho');
    expect(readMessage(ptBR, 'assets.models.dragon')).toBe('Dragão');
    expect(readMessage(ptBR, 'assets.hdris.wooden-studio-17')).toBe(
      'Estúdio de Madeira 17',
    );
    expect(readMessage(ptBR, 'assets.hdris.peppermint-powerplant')).toBe(
      'Peppermint Powerplant',
    );
    expect(readMessage(ptBR, 'assets.textures.uv-checker-01')).toBe(
      'UV Checker 01',
    );
  });
});

/**
 * Reads a dot-separated key. Locale JSON is data, so the shape is checked
 * rather than asserted: a renamed id must fail here, not in the browser.
 */
function readMessage(
  messages: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  let node: unknown = messages;

  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;

    const record = node as Readonly<Record<string, unknown>>;
    if (!Object.hasOwn(record, segment)) return undefined;
    node = record[segment];
  }

  return typeof node === 'string' ? node : undefined;
}
