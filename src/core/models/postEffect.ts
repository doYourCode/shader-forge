import type { InjectedBlockRange } from '@/core/shader/uniformCodegen';

/**
 * Output transform applied by the internal display pass after the effect
 * stack has run in linear space.
 */
export type TonemapMode = 'none' | 'reinhard' | 'aces';

export const TONEMAP_MODES: readonly TonemapMode[] = [
  'none',
  'reinhard',
  'aces',
];

export function isTonemapMode(value: string): value is TonemapMode {
  return (TONEMAP_MODES as readonly string[]).includes(value);
}

/**
 * One user-authored view-space effect. Effects are fragment-only: the
 * fullscreen vertex stage is internal and fixed, so a document is exactly the
 * fragment source the user edits.
 */
export interface PostEffectDocument {
  readonly id: string;
  name: string;
  enabled: boolean;
  fragment: string;
}

/**
 * A document projected onto the source handed to the driver, with the
 * generated user-data block injected and the names that block declares.
 * Diagnostics are attributed through `editorSource`.
 */
export interface PostEffectSource {
  readonly id: string;
  readonly name: string;
  /** The assembled source compiled by Babylon (block included). */
  readonly fragment: string;
  /** The document as the editor holds it. */
  readonly editorSource: string;
  readonly extraUniforms: readonly string[];
  readonly extraSamplers: readonly string[];
  readonly injected: InjectedBlockRange | null;
  readonly declarationRowByLine: readonly number[];
}

/** The ordered list of enabled effects plus the output transform. */
export interface PostEffectStack {
  readonly effects: readonly PostEffectSource[];
  readonly tonemap: TonemapMode;
}
