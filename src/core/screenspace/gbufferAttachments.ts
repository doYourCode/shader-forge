import type { GbufferDebugMode } from '@/core/constants/screenSpaceDebug';
import { SCREEN_SPACE_SAMPLER_NAMES } from '@/core/constants/screenSpaceAbi';

/**
 * The scene-data targets a screen-space pass can read.
 *
 * Babylon's PrePass renders every requested attachment in one MRT pass, so each
 * one is paid for by every opaque draw. The pipeline requests exactly the set
 * the effect stack reads (plus whatever the active debug view displays), which
 * keeps the default passthrough at a plain colour target.
 */
export type ScreenSpaceAttachment =
  'depth' | 'normal' | 'albedo' | 'material' | 'velocity';

/** Canonical order; the MRT layout is derived from it, so it must be stable. */
export const SCREEN_SPACE_ATTACHMENTS: readonly ScreenSpaceAttachment[] = [
  'depth',
  'normal',
  'albedo',
  'material',
  'velocity',
];

const SAMPLER_ATTACHMENTS: readonly (readonly [
  string,
  ScreenSpaceAttachment,
])[] = [
  [SCREEN_SPACE_SAMPLER_NAMES.depth, 'depth'],
  [SCREEN_SPACE_SAMPLER_NAMES.normal, 'normal'],
  [SCREEN_SPACE_SAMPLER_NAMES.albedo, 'albedo'],
  [SCREEN_SPACE_SAMPLER_NAMES.material, 'material'],
  [SCREEN_SPACE_SAMPLER_NAMES.velocity, 'velocity'],
];

/**
 * Attachments each debug view reads. The display shader reconstructs metallic
 * from albedo + material and masks material/velocity by `normal.a`, so those
 * views need more than their headline target.
 */
const DEBUG_ATTACHMENTS: Record<
  GbufferDebugMode,
  readonly ScreenSpaceAttachment[]
> = {
  off: [],
  scene: [],
  depth: ['depth'],
  normal: ['normal'],
  albedo: ['albedo'],
  material: ['normal', 'albedo', 'material'],
  velocity: ['normal', 'velocity'],
  objectId: [],
  transparent: [],
};

/**
 * Union of the attachments the compiled effects read and the debug view needs.
 * An empty set means the pipeline can render the scene straight into the first
 * post-process target with no PrePass at all.
 */
export function requiredScreenSpaceAttachments(
  samplers: ReadonlySet<string>,
  debugMode: GbufferDebugMode,
): ReadonlySet<ScreenSpaceAttachment> {
  const required = new Set<ScreenSpaceAttachment>(DEBUG_ATTACHMENTS[debugMode]);

  for (const [sampler, attachment] of SAMPLER_ATTACHMENTS) {
    if (samplers.has(sampler)) required.add(attachment);
  }

  return required;
}

/** Requests in MRT order, so an unchanged set never rebuilds the layout. */
export function orderedScreenSpaceAttachments(
  attachments: ReadonlySet<ScreenSpaceAttachment>,
): readonly ScreenSpaceAttachment[] {
  return SCREEN_SPACE_ATTACHMENTS.filter((attachment) =>
    attachments.has(attachment),
  );
}
