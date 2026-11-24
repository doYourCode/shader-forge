import { Vector3, type AbstractMesh, type Material } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';

import {
  classifyMeshes,
  materialsForMesh,
  sceneWorldBounds,
} from './SceneAssetProvider';

describe('scene asset splitting', () => {
  it('collects materials from submeshes and removes duplicates', () => {
    const shared = { name: 'shared' } as unknown as Material;
    const other = { name: 'other' } as unknown as Material;
    const mesh = {
      material: shared,
      subMeshes: [
        { getMaterial: () => shared },
        { getMaterial: () => other },
        { getMaterial: () => null },
      ],
    } as unknown as AbstractMesh;

    expect(materialsForMesh(mesh)).toEqual([shared, other]);
  });

  it('classifies multi-material meshes conservatively', () => {
    expect(classifyMeshes([{ alpha: 1 } as unknown as Material])).toBe(
      'opaque',
    );
    expect(
      classifyMeshes([
        { alpha: 1 } as unknown as Material,
        {
          alpha: 1,
          subSurface: { isRefractionEnabled: true },
        } as unknown as Material,
      ]),
    ).toBe('transparent');
    expect(classifyMeshes([])).toBe('ignored');
  });

  it('computes the union of world bounds', () => {
    const mesh = (min: Vector3, max: Vector3): AbstractMesh =>
      ({
        getTotalVertices: () => 3,
        computeWorldMatrix: () => {},
        getBoundingInfo: () => ({
          boundingBox: {
            minimumWorld: min,
            maximumWorld: max,
          },
        }),
      }) as unknown as AbstractMesh;

    const bounds = sceneWorldBounds([
      mesh(new Vector3(-2, 0, -1), new Vector3(1, 4, 2)),
      mesh(new Vector3(0, -1, 0), new Vector3(5, 2, 3)),
    ]);

    expect(bounds?.min.asArray()).toEqual([-2, -1, -1]);
    expect(bounds?.max.asArray()).toEqual([5, 4, 3]);
  });

  it('returns null when no mesh has vertices', () => {
    const empty = {
      getTotalVertices: () => 0,
    } as unknown as AbstractMesh;

    expect(sceneWorldBounds([empty])).toBeNull();
  });
});
