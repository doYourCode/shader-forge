// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import {
  byteToUnit,
  clampUnit,
  parseHexColor,
  rgbToHex,
  rgbaToHex,
  unitToByte,
} from './color';

describe('color helpers', () => {
  describe('clampUnit', () => {
    it('clamps channels into the unit range', () => {
      expect(clampUnit(-0.5)).toBe(0);
      expect(clampUnit(0.25)).toBe(0.25);
      expect(clampUnit(1.5)).toBe(1);
    });

    it('treats non-finite channels as zero', () => {
      expect(clampUnit(Number.NaN)).toBe(0);
      expect(clampUnit(Number.POSITIVE_INFINITY)).toBe(0);
    });
  });

  describe('byte conversion', () => {
    it('rounds unit channels to bytes', () => {
      expect(unitToByte(0)).toBe(0);
      expect(unitToByte(0.5)).toBe(128);
      expect(unitToByte(1)).toBe(255);
      expect(unitToByte(2)).toBe(255);
      expect(unitToByte(-1)).toBe(0);
    });

    it('converts bytes back into exact unit channels', () => {
      expect(byteToUnit(0)).toBe(0);
      expect(byteToUnit(255)).toBe(1);
      expect(byteToUnit(128)).toBeCloseTo(128 / 255, 10);
    });

    it('clamps and defaults non-finite bytes', () => {
      expect(byteToUnit(-10)).toBe(0);
      expect(byteToUnit(300)).toBe(1);
      expect(byteToUnit(Number.NaN)).toBe(0);
    });
  });

  describe('rgbToHex', () => {
    it('serialises lowercase opaque hex', () => {
      expect(rgbToHex({ r: 1, g: 0, b: 0 })).toBe('#ff0000');
      expect(rgbToHex({ r: 0.5, g: 0, b: 1 })).toBe('#8000ff');
    });

    it('clamps and rounds each channel', () => {
      expect(rgbToHex({ r: -1, g: 0.001, b: 2 })).toBe('#0000ff');
    });
  });

  describe('rgbaToHex', () => {
    it('appends the alpha byte in lowercase', () => {
      expect(rgbaToHex({ r: 1, g: 0, b: 0, a: 0.5 })).toBe('#ff000080');
      expect(rgbaToHex({ r: 0, g: 0, b: 0, a: 0 })).toBe('#00000000');
      expect(rgbaToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#ffffffff');
    });
  });

  describe('parseHexColor', () => {
    it('expands three-digit shorthand', () => {
      const parsed = parseHexColor('#abc');

      expect(parsed).not.toBeNull();
      expect(parsed && 'a' in parsed).toBe(false);
      expect(parsed?.r).toBeCloseTo(170 / 255, 10);
      expect(parsed?.g).toBeCloseTo(187 / 255, 10);
      expect(parsed?.b).toBeCloseTo(204 / 255, 10);
    });

    it('expands four-digit shorthand including alpha', () => {
      const parsed = parseHexColor('abcd');

      expect(parsed).toEqual(
        expect.objectContaining({
          r: 170 / 255,
          g: 187 / 255,
          b: 204 / 255,
          a: 221 / 255,
        }),
      );
    });

    it('parses six-digit hex with or without a leading hash', () => {
      const withHash = parseHexColor('#A1B2C3');
      const withoutHash = parseHexColor('a1b2c3');

      expect(withHash).toEqual(withoutHash);
      expect(withHash).toEqual({
        r: 161 / 255,
        g: 178 / 255,
        b: 195 / 255,
      });
    });

    it('parses eight-digit hex including alpha', () => {
      const parsed = parseHexColor('#a1b2c3dd');

      expect(parsed).toEqual(expect.objectContaining({ a: 221 / 255 }));
    });

    it('trims surrounding whitespace', () => {
      expect(parseHexColor('  #fff  ')).toEqual({
        r: 1,
        g: 1,
        b: 1,
      });
    });

    it('round-trips through the serialisers', () => {
      const rgb = parseHexColor('#ff8000');
      const rgba = parseHexColor('ff800080');
      if (!rgb || 'a' in rgb || !rgba || !('a' in rgba)) {
        throw new Error('expected valid hex fixtures');
      }

      expect(rgbToHex(rgb)).toBe('#ff8000');
      expect(rgbaToHex(rgba)).toBe('#ff800080');
    });

    it.each([
      '',
      '#',
      '#12',
      '#12345',
      '#1234567',
      '#gggggg',
      'red',
      '#ff0000ff00',
    ])('rejects invalid input %j', (input) => {
      expect(parseHexColor(input)).toBeNull();
    });
  });
});
