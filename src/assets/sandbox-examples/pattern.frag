#version 300 es
precision highp float;

// Patterns: fract() tiles UV space, step() turns a value into a hard edge.

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

float checker(vec2 uv, float cells)
{
    vec2 grid = floor(uv * cells);
    return mod(grid.x + grid.y, 2.0);
}

void main(void)
{
    // Correct the aspect ratio before tiling so squares stay square.
    vec2 uv = vUv;
    uv.x *= uResolution.x / uResolution.y;

    float tiles = checker(uv, 8.0);
    vec3 color = mix(vec3(0.10, 0.12, 0.20), vec3(0.85, 0.88, 0.95), tiles);

    // Concentric rings from the centred distance field.
    vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    float rings = step(0.5, fract(length(p) * 12.0 - uTime));
    color = mix(color, vec3(0.95, 0.55, 0.20), rings * 0.55);

    fragColor = vec4(color, 1.0);
}
