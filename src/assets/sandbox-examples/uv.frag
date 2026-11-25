#version 300 es
precision highp float;

// Lesson 1: UV coordinates as colour.
// vUv is the normalised screen coordinate: (0,0) bottom-left, (1,1) top-right.

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

void main(void)
{
    // Red grows to the right, green grows upward, blue pulses with time.
    vec3 color = vec3(vUv.x, vUv.y, 0.5 + 0.5 * sin(uTime));

    fragColor = vec4(color, 1.0);
}
