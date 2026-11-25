#version 300 es
precision highp float;

// Vignette: darken the image toward the frame edges.
// Works in any editor; only the previous pass and the resolution are needed.

in vec2 vUV;

uniform sampler2D textureSampler;
uniform vec2 resolution;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec3 color = texture(textureSampler, vUV).rgb;

    // Aspect-corrected distance from the centre.
    vec2 p = (vUV - 0.5) * 2.0;
    p.x *= resolution.x / resolution.y;
    float distanceFromCentre = length(p);

    float vignette = smoothstep(0.55, 1.25, distanceFromCentre);
    color *= mix(1.0, 0.22, vignette);

    fragColor = vec4(color, 1.0);
}
