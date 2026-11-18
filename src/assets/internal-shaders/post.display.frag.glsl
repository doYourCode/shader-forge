#version 300 es
precision highp float;

// Last pass of the post chain: output transform plus display-space encode.
// toneMappingMode: 0 = none, 1 = Reinhard, 2 = ACES filmic.

in vec2 vUV;

uniform sampler2D textureSampler;
uniform float toneMappingMode;

layout(location = 0) out vec4 fragColor;

vec3 acesFilm(vec3 x)
{
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 linearToSrgb(vec3 color)
{
    vec3 high = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
    vec3 low = color * 12.92;
    return mix(high, low, step(color, vec3(0.0031308)));
}

void main(void)
{
    vec3 color = max(texture(textureSampler, vUV).rgb, 0.0);

    if (toneMappingMode > 1.5) {
        color = acesFilm(color);
    } else if (toneMappingMode > 0.5) {
        color = color / (1.0 + color);
    }

    fragColor = vec4(linearToSrgb(clamp(color, 0.0, 1.0)), 1.0);
}
