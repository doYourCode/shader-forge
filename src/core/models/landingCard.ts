export type LandingIconName = 'cube' | 'scan' | 'screen' | 'docs';

/** Decorative artwork rendered inside the card's media frame. */
export type LandingMediaKind = 'sphere' | 'fragment' | 'gbuffer' | 'docs';

/** Accent applied to the card edge, icon and ambient glow. */
export type LandingAccent = 'cyan' | 'violet' | 'teal';

export interface ILandingCard {
  id: string;
  title: string;
  description: string;
  /**
   * Whether the card has a destination. Announced-only cards stay visible but
   * are never rendered as links; they omit `to`.
   */
  enabled: boolean;
  /** Route for an enabled card. */
  to?: string;
  /** Optional highlighted description (e.g., disabled reason) */
  note?: string;
  /** If true, card is disabled when WebGPU is unavailable */
  requiresWebGpu?: boolean;
  /** Icon shown in the card's top-left badge. */
  icon: LandingIconName;
  /** Artwork shown above the copy. */
  media: LandingMediaKind;
  /** Per-card color identity. */
  accent: LandingAccent;
}
