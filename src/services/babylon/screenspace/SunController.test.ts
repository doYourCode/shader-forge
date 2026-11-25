import type { AbstractMesh } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';

import type { LoadedSceneMeshes } from './SceneAssetProvider';
import { shadowCasters, shadowReceivers } from './SunController';

function mesh(name: string, isAnInstance = false): AbstractMesh {
  return { name, isAnInstance } as unknown as AbstractMesh;
}

function split(overrides: Partial<LoadedSceneMeshes> = {}): LoadedSceneMeshes {
  return { opaque: [], transparent: [], ignored: [], ...overrides };
}

describe('shadowCasters', () => {
  it('lists opaque source meshes and drops instances', () => {
    const source = mesh('window');
    const instance = mesh('window-instance', true);

    expect(shadowCasters(split({ opaque: [source, instance] }))).toEqual([
      source,
    ]);
  });

  it('never casts from the transparent/transmissive subset', () => {
    const glass = mesh('glass');
    const wall = mesh('wall');

    expect(
      shadowCasters(split({ opaque: [wall], transparent: [glass] })),
    ).toEqual([wall]);
  });
});

describe('shadowReceivers', () => {
  it('skips instances, whose source mesh carries the flag', () => {
    const source = mesh('window');
    const instance = mesh('window-instance', true);

    expect(shadowReceivers(split({ opaque: [source, instance] }))).toEqual([
      source,
    ]);
  });

  it('includes the transparent subset', () => {
    const wall = mesh('wall');
    const glass = mesh('glass');

    expect(
      shadowReceivers(split({ opaque: [wall], transparent: [glass] })),
    ).toEqual([wall, glass]);
  });
});
