export interface ILandingCard {
  id: string;
  title: string;
  description: string;
  /** Where clicking the card navigates. Empty = non-clickable card. */
  to?: string;
  /** Optional highlighted description (e.g., disabled reason) */
  note?: string;
  /** If true, card is disabled when WebGPU is unavailable */
  requiresWebGpu?: boolean;
}