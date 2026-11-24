import { describe, expect, it } from 'vitest';

import {
  classifySceneMaterials,
  computeSceneFraming,
  isAlphaBlendedMaterial,
  isTransmissiveMaterial,
} from './sceneClassification';

describe('scene mesh classification', () => {
  it('sends transmissive materials to the transparent overlay', () => {
    expect(
      classifySceneMaterials([
        { alpha: 1, subSurface: { isRefractionEnabled: true } },
      ]),
    ).toBe('transparent');
    // PBR materials expose refractionIntensity = 1 even when refraction is
    // disabled, so that field alone must not move a mesh to the overlay.
    expect(
      classifySceneMaterials([
        { alpha: 1, subSurface: { refractionIntensity: 0.5 } },
      ]),
    ).toBe('opaque');
  });

  it('sends alpha-blended materials to the transparent overlay', () => {
    expect(classifySceneMaterials([{ alpha: 0.5 }])).toBe('transparent');
    expect(classifySceneMaterials([{ alpha: 1, transparencyMode: 2 }])).toBe(
      'transparent',
    );
    expect(
      classifySceneMaterials([{ alpha: 1, needAlphaBlending: () => true }]),
    ).toBe('transparent');
  });

  it('keeps opaque and alpha-tested materials in the G-buffer', () => {
    expect(classifySceneMaterials([{ alpha: 1 }])).toBe('opaque');
    expect(
      classifySceneMaterials([{ alpha: 1, needAlphaBlending: () => false }]),
    ).toBe('opaque');
    expect(classifySceneMaterials([])).toBe('ignored');
  });

  it('treats one transparent submesh as enough to move the whole mesh', () => {
    expect(
      classifySceneMaterials([
        { alpha: 1 },
        { alpha: 1, subSurface: { isRefractionEnabled: true } },
      ]),
    ).toBe('transparent');
  });

  it('exposes the individual predicates', () => {
    expect(isTransmissiveMaterial({})).toBe(false);
    expect(isTransmissiveMaterial({ subSurface: {} })).toBe(false);
    expect(isAlphaBlendedMaterial({})).toBe(false);
    expect(isAlphaBlendedMaterial({ alpha: 0.2 })).toBe(true);
  });
});

describe('scene framing', () => {
  it('centres the camera on the bounds and derives a usable clip range', () => {
    const framing = computeSceneFraming(
      { x: -10, y: 0, z: -10 },
      { x: 10, y: 10, z: 10 },
    );

    expect(framing.center).toEqual({ x: 0, y: 5, z: 0 });
    expect(framing.radius).toBeGreaterThan(10);
    expect(framing.minZ).toBeGreaterThan(0);
    expect(framing.maxZ).toBeGreaterThan(framing.minZ);
    expect(framing.position.z).toBeGreaterThan(framing.center.z);
  });

  it('handles a degenerate scene without dividing by zero', () => {
    const framing = computeSceneFraming(
      { x: 1, y: 1, z: 1 },
      { x: 1, y: 1, z: 1 },
    );

    expect(Number.isFinite(framing.position.x)).toBe(true);
    expect(Number.isFinite(framing.position.y)).toBe(true);
    expect(Number.isFinite(framing.position.z)).toBe(true);
    expect(framing.radius).toBeGreaterThan(0);
  });
});
