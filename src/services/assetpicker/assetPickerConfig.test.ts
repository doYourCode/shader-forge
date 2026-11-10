import { describe, expect, it } from 'vitest';

import {
  REPOSITORY_ADAPTER_ID,
  REPOSITORY_STORAGE_ID,
  buildAssetPickerConfig,
  toAssetPickerLanguage,
} from './assetPickerConfig';

const LABELS = {
  title: 'Select a texture',
  storage: 'Bundled textures',
};

describe('buildAssetPickerConfig', () => {
  it('configures exactly one storage bound to the requested sampler', () => {
    const config = buildAssetPickerConfig({ sampler: 'sampler2D' }, LABELS, 'en');

    expect(Object.keys(config.storages)).toEqual([REPOSITORY_STORAGE_ID]);
    expect(config.storages[REPOSITORY_STORAGE_ID]).toEqual({
      adapter: REPOSITORY_ADAPTER_ID,
      label: LABELS.storage,
      sampler: 'sampler2D',
    });
  });

  it('picks a single file and delivers URL thumbnails', () => {
    const config = buildAssetPickerConfig({ sampler: 'sampler2D' }, LABELS, 'en');

    expect(config.pick).toEqual({
      limit: 1,
      types: ['file'],
      extensions: [],
    });
    expect(config.thumbnails).toBe('url');
  });

  it('forwards the title and language labels', () => {
    const config = buildAssetPickerConfig({ sampler: 'sampler2D' }, LABELS, 'de');

    expect(config.title).toBe(LABELS.title);
    expect(config.language).toBe('de');
  });

  it('follows the sampler kind so cube uniforms cannot browse 2D assets', () => {
    const config = buildAssetPickerConfig(
      { sampler: 'samplerCube' },
      LABELS,
      'en',
    );

    expect(config.storages[REPOSITORY_STORAGE_ID]?.sampler).toBe('samplerCube');
  });
});

describe('toAssetPickerLanguage', () => {
  it('maps German locales to de', () => {
    expect(toAssetPickerLanguage('de')).toBe('de');
    expect(toAssetPickerLanguage('de-DE')).toBe('de');
    expect(toAssetPickerLanguage('DE-at')).toBe('de');
  });

  it('falls back to English for locales AssetPicker does not ship', () => {
    expect(toAssetPickerLanguage('pt-BR')).toBe('en');
    expect(toAssetPickerLanguage('en-US')).toBe('en');
    expect(toAssetPickerLanguage('fr')).toBe('en');
  });
});
