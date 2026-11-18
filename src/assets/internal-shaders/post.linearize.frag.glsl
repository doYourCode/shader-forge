#version 300 es
precision highp float;

// First pass of the post chain: decode the scene colour from display space
// into the linear working space every effect is authored in.

in vec2 vUV;

uniform sampler2D textureSampler;

layout(location = 0) out vec4 fragColor;

vec3 srgbToLinear(vec3 color)
{
    vec3 high = pow((color + 0.055) / 1.055, vec3(2.4));
    vec3 low = color / 12.92;
    return mix(high, low, step(color, vec3(0.04045)));
}

void main(void)
{
    vec3 linear = srgbToLinear(texture(textureSampler, vUV).rgb);
    fragColor = vec4(linear, 1.0);
}
