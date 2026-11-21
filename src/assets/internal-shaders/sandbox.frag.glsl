#version 300 es
precision highp float;

// The sandbox ABI: the normalized coordinate arrives from the fullscreen
// triangle, while the engine supplies resolution and elapsed time.
in vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

void main(void)
{
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;

    float t = uTime * 0.35;
    float radius = length(p);
    float angle = atan(p.y, p.x);
    float ripple = sin(radius * 10.0 - t * 3.0 + 3.0 * sin(angle * 3.0 + t));

    vec3 color = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + ripple + t);
    color *= 1.0 - smoothstep(0.65, 1.45, radius);

    fragColor = vec4(color, 1.0);
}
