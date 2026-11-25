#version 300 es
precision highp float;

// Separable Gaussian blur. This is the horizontal pass; the loop is symmetric
// around the centre, so the same program works for the vertical pass if you
// swap texelSize.x for texelSize.y (or add a direction uniform).

in vec2 vUV;

uniform sampler2D textureSampler;
uniform vec2 texelSize;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    // Nine taps, weights approximating a Gaussian with sigma ~ 2.
    const float weights[5] = float[](0.227027, 0.194594, 0.121621, 0.054054, 0.016216);

    vec3 color = texture(textureSampler, vUV).rgb * weights[0];

    for (int tap = 1; tap < 5; tap++)
    {
        vec2 offset = vec2(float(tap) * texelSize.x, 0.0);
        color += texture(textureSampler, vUV + offset).rgb * weights[tap];
        color += texture(textureSampler, vUV - offset).rgb * weights[tap];
    }

    fragColor = vec4(color, 1.0);
}
