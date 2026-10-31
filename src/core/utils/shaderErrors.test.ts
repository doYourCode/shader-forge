import { describe, expect, it } from 'vitest';

import {
  detectGlslVersion,
  parseShaderCompileErrors,
  type ShaderCompileRecord,
} from './shaderErrors';

const USER_300_FRAGMENT = `#version 300 es
precision highp float;

layout(location = 0) out vec4 fragColor;

void main() {
  fragColor = vec4(1.0);
}`;

const USER_100_FRAGMENT = `precision highp float;
varying vec3 vNormal;

void main() {
  gl_FragColor = vec4(vNormal, 1.0);
}`;

/** Mimics the source Babylon hands to WebGL2 for a #version 300 es source. */
function driverSource300(userSource: string): string {
  return `#version 300 es\n#define WEBGL2 \n${userSource.replace(
    '#version 300 es',
    '',
  )}`;
}

/** Mimics Babylon's upgrade of a 1.00 fragment source on WebGL2. */
const DRIVER_100_FRAGMENT = `#version 300 es
#define WEBGL2 
precision highp float;
in vec3 vNormal;

layout(location = 0) out vec4 glFragColor;
void main() {
  glFragColor = vec4(vNormal, 1.0);
}`;

describe('detectGlslVersion', () => {
  it('detects an explicit 300 es declaration', () => {
    expect(detectGlslVersion('#version 300 es\nprecision highp float;')).toBe(
      '300 es',
    );
  });

  it('defaults to 1.00 without an explicit 300 es declaration', () => {
    expect(detectGlslVersion(null)).toBe('100');
    expect(detectGlslVersion(undefined)).toBe('100');
    expect(detectGlslVersion('')).toBe('100');
    expect(detectGlslVersion('#version 100\nprecision highp float;')).toBe(
      '100',
    );
    expect(detectGlslVersion('precision highp float;')).toBe('100');
  });

  it('does not treat a commented directive as a declaration', () => {
    expect(detectGlslVersion('// #version 300 es\nprecision highp float;')).toBe(
      '100',
    );
  });

  it('accepts leading whitespace before the directive', () => {
    expect(detectGlslVersion('\n  #version 300 es')).toBe('300 es');
  });
});

describe('parseShaderCompileErrors version handling', () => {
  it('uses 3.00 advice and maps the line for a 3.00 fragment source', () => {
    const records: ShaderCompileRecord[] = [
      {
        stage: 'fragment',
        log: "ERROR: 0:9: 'gl_FragColor' : undeclared identifier",
        source: driverSource300(USER_300_FRAGMENT),
      },
    ];

    const errors = parseShaderCompileErrors(records, {
      vertex: '',
      fragment: USER_300_FRAGMENT,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(7);
    expect(errors[0].advice).toContain('layout(location = 0) out vec4 fragColor;');
  });

  it('uses 1.00 advice when the user source omits #version', () => {
    // The driver source starts with Babylon's injected #version 300 es; the
    // version must come from the editor source instead.
    const records: ShaderCompileRecord[] = [
      {
        stage: 'fragment',
        log: "ERROR: 0:8: 'gl_FragColor' : undeclared identifier",
        source: DRIVER_100_FRAGMENT,
      },
    ];

    const errors = parseShaderCompileErrors(records, {
      vertex: '',
      fragment: USER_100_FRAGMENT,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(5);
    expect(errors[0].title).toBe("Unknown identifier 'gl_FragColor'");
    expect(errors[0].advice).toContain('attribute, or varying');
  });

  it('passes the version to generic advice at the fragment stage', () => {
    const log = 'ERROR: 0:4: some driver weirdness';

    const errors300 = parseShaderCompileErrors(
      [
        {
          stage: 'fragment',
          log,
          source: driverSource300(USER_300_FRAGMENT),
        },
      ],
      { vertex: '', fragment: USER_300_FRAGMENT },
    );
    const errors100 = parseShaderCompileErrors(
      [
        {
          stage: 'fragment',
          log: 'ERROR: 0:3: some driver weirdness',
          source: DRIVER_100_FRAGMENT,
        },
      ],
      { vertex: '', fragment: USER_100_FRAGMENT },
    );

    expect(errors300[0].advice).toContain('GLSL ES 3.00');
    expect(errors100[0].advice).toContain('GLSL ES 1.00');
  });

  it('treats a program diagnostic as 3.00 when either stage declares it', () => {
    const errors = parseShaderCompileErrors(
      [
        {
          stage: 'program',
          log: 'ERROR: some driver weirdness',
          source: null,
        },
      ],
      { vertex: '#version 300 es\nvoid main() {}', fragment: USER_100_FRAGMENT },
    );

    expect(errors[0].advice).toContain('GLSL ES 3.00');
  });

  it('uses the stage version for fallback errors', () => {
    const errors = parseShaderCompileErrors(
      [],
      { vertex: '', fragment: USER_300_FRAGMENT },
      'FRAGMENT SHADER ERROR: some driver weirdness',
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].advice).toContain('GLSL ES 3.00');
  });
});
