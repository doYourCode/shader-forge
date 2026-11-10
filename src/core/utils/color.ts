import type {
  UserColor3Value,
  UserColor4Value,
} from '@/core/models/userUniform';

const HEX_PATTERN = /^#?([0-9a-f]+)$/i;
const HEX_LENGTHS = new Set([3, 4, 6, 8]);

/** Clamps a non-finite or out-of-range unit channel into [0, 1]. */
export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.min(1, Math.max(0, value));
}

/** Converts a unit channel into a rounded byte, so picking and typing agree. */
export function unitToByte(value: number): number {
  return Math.round(clampUnit(value) * 255);
}

/** Converts a byte channel back into the unit range used by the document. */
export function byteToUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.min(255, Math.max(0, value)) / 255;
}

/** Serialises an RGB value as lowercase `#rrggbb`. */
export function rgbToHex(color: UserColor3Value): string {
  return `#${hexChannel(color.r)}${hexChannel(color.g)}${hexChannel(color.b)}`;
}

/** Serialises an RGBA value as lowercase `#rrggbbaa`. */
export function rgbaToHex(color: UserColor4Value): string {
  return `${rgbToHex(color)}${hexChannel(color.a)}`;
}

/**
 * Parses an optional-`#`, 3/4/6/8-digit hex colour into unit channels. An
 * invalid string returns null so callers can keep the last valid value.
 */
export function parseHexColor(
  hex: string,
): UserColor3Value | UserColor4Value | null {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) return null;

  const digits = match[1].toLowerCase();
  if (!HEX_LENGTHS.has(digits.length)) return null;

  // Shorthand digits repeat (`f` -> `ff`), which also normalises 4/8 digits.
  const expanded =
    digits.length <= 4
      ? digits
          .split('')
          .map((digit) => `${digit}${digit}`)
          .join('')
      : digits;

  const r = parseChannel(expanded.slice(0, 2));
  const g = parseChannel(expanded.slice(2, 4));
  const b = parseChannel(expanded.slice(4, 6));

  if (expanded.length === 8) {
    return { r, g, b, a: parseChannel(expanded.slice(6, 8)) };
  }

  return { r, g, b };
}

function hexChannel(value: number): string {
  return unitToByte(value).toString(16).padStart(2, '0');
}

function parseChannel(digits: string): number {
  return byteToUnit(parseInt(digits, 16));
}
