import bunnyUrl from '@/assets/meshes/Bunny.glb?url';
import cubeUrl from '@/assets/meshes/Cube.glb?url';
import monkeyUrl from '@/assets/meshes/monkey.glb?url';
import sphereUrl from '@/assets/meshes/sphere.glb?url';
import dragonUrl from '@/assets/meshes/Dragon.glb?url';
import type { PreviewModel } from '@/core/models/previewModel';

const defaultModel: PreviewModel = {
  id: 'monkey',
  label: 'Monkey',
  url: monkeyUrl,
};

/**
 * Models available in the scene viewer. Adding another GLB is a one-line
 * change: import its URL and append an entry to this list.
 */
export const previewModels: readonly PreviewModel[] = [
  defaultModel,
  { id: 'sphere', label: 'Sphere', url: sphereUrl },
  { id: 'cube', label: 'Cube', url: cubeUrl },
  { id: 'bunny', label: 'Bunny', url: bunnyUrl },
  { id: 'dragon', label: 'Dragon', url: dragonUrl },
];

export const defaultPreviewModel = defaultModel;

export function findPreviewModel(id: string): PreviewModel | undefined {
  return previewModels.find((model) => model.id === id);
}
