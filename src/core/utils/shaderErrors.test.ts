import { describe, expect, it } from 'vitest';

import {
  assembleUserData,
  locateInjectedBlock,
} from '@/core/shader/uniformCodegen';
import type { UserDataDocument } from '@/core/models/userUniform';
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

/** Mimics Babylon's upgrade of an arbitrary 1.00 fragment source. */
function driverSource100(source: string): string {
  const upgraded = source
    .replace(/\bvarying\b/g, 'in')
    .replace(/\bgl_FragColor\b/g, 'glFragColor');

  return `#version 300 es\n#define WEBGL2 \n${upgraded.replace(
    /(\n\s*void main)/,
    '\nlayout(location = 0) out vec4 glFragColor;$1',
  )}`;
}

/** 1-based line containing `needle`; fails loudly when the fixture drifts. */
function lineOf(source: string, needle: string): number {
  const index = source
    .replace(/\r/g, '')
    .split('\n')
    .findIndex((line) => line.includes(needle));

  if (index < 0) throw new Error(`No line containing "${needle}"`);
  return index + 1;
}

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

describe('parseShaderCompileErrors user-data attribution', () => {
  const USER_DATA: UserDataDocument = {
    revision: 1,
    definitions: [
      {
        id: 'u1',
        name: 'tint',
        kind: 'color',
        stages: 'fragment',
        value: { r: 1, g: 1, b: 1 },
      },
      {
        id: 'u2',
        name: 'scale',
        kind: 'float',
        stages: 'fragment',
        value: 2,
      },
    ],
  };

  const USER_300_VERTEX = `#version 300 es
precision highp float;

in vec3 position;

void main() {
  gl_Position = vec4(position, 1.0);
}`;

  const VERTEX_DATA: UserDataDocument = {
    revision: 1,
    definitions: [
      {
        id: 'v1',
        name: 'sunDir',
        kind: 'direction',
        stages: 'vertex',
        value: { x: 0, y: 1, z: 0 },
      },
    ],
  };

  function compileFragment() {
    const assembly = assembleUserData(USER_DATA, '', USER_300_FRAGMENT);
    const driverSource = driverSource300(assembly.fragment);
    const block = locateInjectedBlock(driverSource);
    if (!block) throw new Error('expected an injected block');

    return { assembly, driverSource, block };
  }

  it('attributes an error inside the block to the definition row', () => {
    const { assembly, driverSource, block } = compileFragment();
    // Block layout: sentinel, tint, scale, values comment, sentinel.
    const tintLine = block.startLine + 1;
    const scaleLine = block.startLine + 2;

    const records: ShaderCompileRecord[] = [
      {
        stage: 'fragment',
        log: `ERROR: 0:${scaleLine}: 'scale' : type mismatch`,
        source: driverSource,
      },
      {
        stage: 'fragment',
        log: `ERROR: 0:${tintLine}: 'tint' : invalid operation`,
        source: driverSource,
      },
    ];

    const errors = parseShaderCompileErrors(records, {
      vertex: '',
      fragment: assembly.fragment,
      editorSource: { vertex: '', fragment: USER_300_FRAGMENT },
      userData: assembly.record,
    });

    expect(errors).toHaveLength(2);
    expect(errors[0].stage).toBe('user_data');
    expect(errors[0].line).toBeNull();
    expect(errors[0].column).toBeNull();
    expect(errors[0].row).toBe(1);
    expect(errors[0].message).toContain('scale');

    expect(errors[1].stage).toBe('user_data');
    expect(errors[1].row).toBe(0);
  });

  it('maps a fragment error after the block to the editor line', () => {
    const { assembly, driverSource, block } = compileFragment();
    const needle = 'fragColor = vec4(1.0);';
    const driverLine = lineOf(driverSource, needle);
    const editorLine = lineOf(USER_300_FRAGMENT, needle);

    const errors = parseShaderCompileErrors(
      [
        {
          stage: 'fragment',
          log: `ERROR: 0:${driverLine}: 'gl_FragColor' : undeclared identifier`,
          source: driverSource,
        },
      ],
      {
        vertex: '',
        fragment: assembly.fragment,
        editorSource: { vertex: '', fragment: USER_300_FRAGMENT },
        userData: assembly.record,
      },
    );

    expect(block.endLine).toBeLessThan(driverLine);
    expect(errors).toHaveLength(1);
    expect(errors[0].stage).toBe('fragment');
    expect(errors[0].line).toBe(editorLine);
    expect(errors[0].line).not.toBe(driverLine);
    expect(errors[0].row).toBeUndefined();
  });

  it('maps the first declaration after the block to the editor line', () => {
    const { assembly, driverSource } = compileFragment();
    const needle = 'layout(location = 0) out vec4 fragColor;';
    const driverLine = lineOf(driverSource, needle);
    const editorLine = lineOf(USER_300_FRAGMENT, needle);

    const errors = parseShaderCompileErrors(
      [
        {
          stage: 'fragment',
          log: `ERROR: 0:${driverLine}: 'fragColor' : syntax error`,
          source: driverSource,
        },
      ],
      {
        vertex: '',
        fragment: assembly.fragment,
        editorSource: { vertex: '', fragment: USER_300_FRAGMENT },
        userData: assembly.record,
      },
    );

    expect(errors[0].line).toBe(editorLine);
    expect(editorLine).toBe(4);
  });

  it('maps a vertex error after its block to the editor line', () => {
    const assembly = assembleUserData(VERTEX_DATA, USER_300_VERTEX, '');
    const driverSource = driverSource300(assembly.vertex);
    const needle = 'gl_Position = vec4(position, 1.0);';

    const errors = parseShaderCompileErrors(
      [
        {
          stage: 'vertex',
          log: `ERROR: 0:${lineOf(driverSource, needle)}: 'position' : undeclared identifier`,
          source: driverSource,
        },
      ],
      {
        vertex: assembly.vertex,
        fragment: '',
        editorSource: { vertex: USER_300_VERTEX, fragment: '' },
        userData: assembly.record,
      },
    );

    expect(errors[0].stage).toBe('vertex');
    expect(errors[0].line).toBe(lineOf(USER_300_VERTEX, needle));
    expect(errors[0].line).toBe(7);
  });

  it('maps both stages independently when both carry a block', () => {
    const document: UserDataDocument = {
      revision: 1,
      definitions: [
        ...USER_DATA.definitions,
        ...VERTEX_DATA.definitions,
      ],
    };
    const assembly = assembleUserData(
      document,
      USER_300_VERTEX,
      USER_300_FRAGMENT,
    );
    const vertexDriver = driverSource300(assembly.vertex);
    const fragmentDriver = driverSource300(assembly.fragment);
    const vertexNeedle = 'gl_Position = vec4(position, 1.0);';
    const fragmentNeedle = 'fragColor = vec4(1.0);';

    const errors = parseShaderCompileErrors(
      [
        {
          stage: 'vertex',
          log: `ERROR: 0:${lineOf(vertexDriver, vertexNeedle)}: 'position' : undeclared identifier`,
          source: vertexDriver,
        },
        {
          stage: 'fragment',
          log: `ERROR: 0:${lineOf(fragmentDriver, fragmentNeedle)}: 'fragColor' : undeclared identifier`,
          source: fragmentDriver,
        },
      ],
      {
        vertex: assembly.vertex,
        fragment: assembly.fragment,
        editorSource: {
          vertex: USER_300_VERTEX,
          fragment: USER_300_FRAGMENT,
        },
        userData: assembly.record,
      },
    );

    expect(errors.map((error) => error.line)).toEqual([
      lineOf(USER_300_VERTEX, vertexNeedle),
      lineOf(USER_300_FRAGMENT, fragmentNeedle),
    ]);
  });

  it('maps an error after a block injected at the top of a headerless source', () => {
    const headerless = `void main() {
  gl_FragColor = vec4(1.0);
}`;
    const assembly = assembleUserData(USER_DATA, '', headerless);
    const driverSource = driverSource300(assembly.fragment);
    const needle = 'gl_FragColor = vec4(1.0);';

    const block = locateInjectedBlock(driverSource);
    expect(block).not.toBeNull();
    expect(block!.startLine).toBe(3);

    const errors = parseShaderCompileErrors(
      [
        {
          stage: 'fragment',
          log: `ERROR: 0:${lineOf(driverSource, needle)}: 'gl_FragColor' : undeclared identifier`,
          source: driverSource,
        },
      ],
      {
        vertex: '',
        fragment: assembly.fragment,
        editorSource: { vertex: '', fragment: headerless },
        userData: assembly.record,
      },
    );

    expect(errors[0].line).toBe(lineOf(headerless, needle));
    expect(errors[0].line).toBe(2);
  });

  it('maps an error after a block when the header contains blank lines', () => {
    const spaced = `#version 300 es

precision highp float;
void main() {
  gl_FragColor = vec4(1.0);
}`;
    const assembly = assembleUserData(USER_DATA, '', spaced);
    const driverSource = driverSource300(assembly.fragment);
    const needle = 'gl_FragColor = vec4(1.0);';

    const errors = parseShaderCompileErrors(
      [
        {
          stage: 'fragment',
          log: `ERROR: 0:${lineOf(driverSource, needle)}: 'gl_FragColor' : undeclared identifier`,
          source: driverSource,
        },
      ],
      {
        vertex: '',
        fragment: assembly.fragment,
        editorSource: { vertex: '', fragment: spaced },
        userData: assembly.record,
      },
    );

    expect(errors[0].line).toBe(lineOf(spaced, needle));
    expect(errors[0].line).toBe(5);
  });

  it('maps an upgraded 1.00 fragment error back to the editor', () => {
    const assembly = assembleUserData(USER_DATA, '', USER_100_FRAGMENT);
    const driverSource = driverSource100(assembly.fragment);
    const needle = 'glFragColor = vec4(vNormal, 1.0);';

    const errors = parseShaderCompileErrors(
      [
        {
          stage: 'fragment',
          log: `ERROR: 0:${lineOf(driverSource, needle)}: 'glFragColor' : undeclared identifier`,
          source: driverSource,
        },
      ],
      {
        vertex: '',
        fragment: assembly.fragment,
        editorSource: { vertex: '', fragment: USER_100_FRAGMENT },
        userData: assembly.record,
      },
    );

    expect(errors[0].line).toBe(
      lineOf(USER_100_FRAGMENT, 'gl_FragColor = vec4(vNormal, 1.0);'),
    );
    expect(errors[0].line).toBe(5);
  });

  it('attributes the row even without the assembly record', () => {
    const { assembly, driverSource, block } = compileFragment();
    const tintLine = block.startLine + 1;

    const errors = parseShaderCompileErrors(
      [
        {
          stage: 'fragment',
          log: `ERROR: 0:${tintLine}: 'tint' : invalid operation`,
          source: driverSource,
        },
      ],
      { vertex: '', fragment: assembly.fragment },
    );

    expect(errors[0].stage).toBe('user_data');
    expect(errors[0].row).toBeNull();
  });
});
