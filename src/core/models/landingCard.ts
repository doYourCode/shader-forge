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
}
