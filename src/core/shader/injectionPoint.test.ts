import { describe, expect, it } from 'vitest';

import {
  findInjectionLine,
  isShaderHeaderDirective,
  isShaderHeaderLine,
} from './injectionPoint';

describe('findInjectionLine', () => {
  it('inserts before the first line when there is no header', () => {
    expect(findInjectionLine(['void main() {}'])).toBe(0);
  });

  it('lands after the last header directive', () => {
    expect(
      findInjectionLine([
        '#version 300 es',
        'precision highp float;',
        '',
        'in vec3 position;',
      ]),
    ).toBe(2);
  });

  it('keeps blanks, comments and #extension inside the header run', () => {
    expect(
      findInjectionLine([
        '// preamble',
        '',
        '#version 300 es',
        '#extension GL_EXT_shader_texture_lod : enable',
        'precision highp float;',
        '',
        '// fragment entrance',
        'in vec3 normal;',
      ]),
    ).toBe(5);
  });

  it('returns the line count when the source is only a header', () => {
    expect(
      findInjectionLine(['#version 300 es', 'precision highp float;']),
    ).toBe(2);
  });

  it('stops at the first non-header construct', () => {
    expect(
      findInjectionLine([
        '#version 300 es',
        'in vec3 position;',
        'precision highp float;',
      ]),
    ).toBe(1);
  });
});

describe('header predicates', () => {
  it('classifies header lines', () => {
    expect(isShaderHeaderLine('')).toBe(true);
    expect(isShaderHeaderLine('   ')).toBe(true);
    expect(isShaderHeaderLine('// note')).toBe(true);
    expect(isShaderHeaderLine('#version 300 es')).toBe(true);
    expect(isShaderHeaderLine('in vec3 position;')).toBe(false);
    expect(isShaderHeaderLine('void main() {}')).toBe(false);
  });

  it('only treats directives as header directives', () => {
    expect(isShaderHeaderDirective('  #version 300 es')).toBe(true);
    expect(isShaderHeaderDirective('precision highp float;')).toBe(true);
    expect(isShaderHeaderDirective('#extension GL_EXT_x : enable')).toBe(true);
    expect(isShaderHeaderDirective('// #version 300 es')).toBe(false);
    expect(isShaderHeaderDirective('in vec3 position;')).toBe(false);
  });
});
