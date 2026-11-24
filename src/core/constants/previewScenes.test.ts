import { describe, expect, it } from 'vitest';

import { resolveSceneUrl } from '@/core/assets/assetUrls';
import { findPreviewScene, previewScenes } from './previewScenes';

const SCENES = import.meta.glob('/src/assets/scenes/*.glb', {
  query: '?url&no-inline',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('preview scenes', () => {
  it('opens Bistro by default', () => {
    expect(previewScenes.default.id).toBe('bistro');
    expect(previewScenes.default.label.length).toBeGreaterThan(0);
    expect(previewScenes.default.url.length).toBeGreaterThan(0);
  });

  it('resolves the bundled scene from the filesystem glob', () => {
    expect(resolveSceneUrl('scenes/bistro_compressed.glb')).toBe(
      SCENES['/src/assets/scenes/bistro_compressed.glb'],
    );
    expect(findPreviewScene('bistro')?.url).toBe(
      SCENES['/src/assets/scenes/bistro_compressed.glb'],
    );
  });

  it('returns undefined for an unknown scene id', () => {
    expect(findPreviewScene('missing')).toBeUndefined();
  });
});
