import { describe, expect, it } from 'vitest';

import {
  buildExamplePickerConfig,
  EXAMPLE_ADAPTER_ID,
  EXAMPLE_STORAGE_ID,
} from './examplePickerConfig';

describe('buildExamplePickerConfig', () => {
  it('picks one file and opens the only storage directly', () => {
    const config = buildExamplePickerConfig(
      { title: 'Select a shader example', storage: 'Shader examples' },
      'de',
    );

    expect(config.title).toBe('Select a shader example');
    expect(config.language).toBe('de');
    expect(config.pick).toEqual({ limit: 1, types: ['file'], extensions: [] });
    expect(config.thumbnails).toBe('url');
    expect(config.autoOpenSingleStorage).toBe(true);
    expect(config.storages[EXAMPLE_STORAGE_ID]).toEqual({
      adapter: EXAMPLE_ADAPTER_ID,
      label: 'Shader examples',
    });
  });

  it('configures exactly one storage, so the grid is the first screen', () => {
    const config = buildExamplePickerConfig(
      { title: 'Examples', storage: 'Examples' },
      'en',
    );

    expect(Object.keys(config.storages)).toEqual([EXAMPLE_STORAGE_ID]);
  });
});
