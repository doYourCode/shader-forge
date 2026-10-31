import { describe, expect, it } from 'vitest';

import { ShaderLineMap } from './shaderLineMap';

const USER_300_FRAGMENT = `#version 300 es
precision highp float;

layout(location = 0) out vec4 fragColor;

void main() {
  vec3 color = vec3(1.0);
  fragColor = vec4(color, 1.0);
}`;

/** The exact shape Babylon hands to WebGL2, including its injected prelude. */
const DRIVER_300_FRAGMENT = `#version 300 es
#define WEBGL2 
#define SHADER_NAME fragment:previewShader
${USER_300_FRAGMENT.replace('#version 300 es', '')}`;

const USER_100_FRAGMENT = `precision highp float;
varying vec3 vNormal;

void main() {
  gl_FragColor = vec4(vNormal, 1.0);
}`;

/** Babylon's 1.00 -> 3.00 upgrade, including the injected output declaration. */
const DRIVER_100_FRAGMENT = `#version 300 es
#define WEBGL2 
#define SHADER_NAME fragment:previewShader
precision highp float;
in vec3 vNormal;

layout(location = 0) out vec4 glFragColor;
void main() {
  glFragColor = vec4(vNormal, 1.0);
}`;

function mapOrThrow(driverSource: string, userSource: string): ShaderLineMap {
  const map = ShaderLineMap.between(driverSource, userSource);
  if (!map) throw new Error('Expected a line map');
  return map;
}

describe('ShaderLineMap with GLSL ES 3.00 sources', () => {
  const map = mapOrThrow(DRIVER_300_FRAGMENT, USER_300_FRAGMENT);

  it('maps the #version line', () => {
    expect(map.toUserLine(1)).toBe(1);
  });

  it('accounts for the injected Babylon prelude', () => {
    expect(map.toUserLine(5)).toBe(2);
  });

  it('maps a user-declared layout out line back to itself', () => {
    // The layout line is identical in both sources, so it must stay mappable.
    expect(map.toUserLine(7)).toBe(4);
  });

  it('maps statements after the layout out line', () => {
    expect(map.toUserLine(9)).toBe(6);
    expect(map.toUserLine(10)).toBe(7);
    expect(map.toUserLine(11)).toBe(8);
    expect(map.toUserLine(12)).toBe(9);
  });
});

describe('ShaderLineMap with upgraded GLSL ES 1.00 sources', () => {
  const map = mapOrThrow(DRIVER_100_FRAGMENT, USER_100_FRAGMENT);

  it('skips the injected fragment output declaration', () => {
    expect(map.toUserLine(8)).toBe(4);
    expect(map.toUserLine(9)).toBe(5);
  });

  it('keeps mapping declarations and closing braces', () => {
    expect(map.toUserLine(4)).toBe(1);
    expect(map.toUserLine(5)).toBe(2);
    expect(map.toUserLine(10)).toBe(6);
  });
});
