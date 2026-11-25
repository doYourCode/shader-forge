/**
 * G-buffer debug views exposed by the Screen Space GLSL Editor.
 *
 * The numeric values are the contract with the display shader; keep them in
 * sync with `post.screenspace.display.frag.glsl`.
 */

import { TRANSPARENT_OVERLAY_ENABLED } from './screenSpaceRender';

export type GbufferDebugMode =
  | 'off'
  | 'scene'
  | 'depth'
  | 'normal'
  | 'albedo'
  | 'material'
  | 'velocity'
  | 'objectId'
  | 'transparent';

export interface GbufferDebugModeOption {
  readonly id: GbufferDebugMode;
  readonly labelKey: string;
  readonly value: number;
}

export const GBUFFER_DEBUG_MODES: readonly GbufferDebugModeOption[] = [
  { id: 'off', labelKey: 'screenSpace.debug.off', value: 0 },
  { id: 'scene', labelKey: 'screenSpace.debug.scene', value: 1 },
  { id: 'depth', labelKey: 'screenSpace.debug.depth', value: 2 },
  { id: 'normal', labelKey: 'screenSpace.debug.normal', value: 3 },
  { id: 'albedo', labelKey: 'screenSpace.debug.albedo', value: 4 },
  { id: 'material', labelKey: 'screenSpace.debug.material', value: 5 },
  { id: 'velocity', labelKey: 'screenSpace.debug.velocity', value: 6 },
  { id: 'objectId', labelKey: 'screenSpace.debug.objectId', value: 7 },
  { id: 'transparent', labelKey: 'screenSpace.debug.transparent', value: 8 },
];

export function debugModeValue(mode: GbufferDebugMode): number {
  return GBUFFER_DEBUG_MODES.find((option) => option.id === mode)?.value ?? 0;
}

/**
 * Modes the current pipeline can show. The transparent view reads the overlay
 * target, which has no content once those surfaces render in the main pass.
 */
export function availableDebugModes(): readonly GbufferDebugModeOption[] {
  if (TRANSPARENT_OVERLAY_ENABLED) return GBUFFER_DEBUG_MODES;

  return GBUFFER_DEBUG_MODES.filter((mode) => mode.id !== 'transparent');
}

export function isGbufferDebugMode(value: string): value is GbufferDebugMode {
  return GBUFFER_DEBUG_MODES.some((option) => option.id === value);
}
