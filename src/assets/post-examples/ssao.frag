#version 300 es
precision highp float;

// Simplified SSAO for the surface post-effect ABI.
// It compares the centre depth with neighbours in a small screen-space disc.
// The screen-space editor has a richer version that reconstructs view-space
// positions from the real depth buffer.

in vec2 vUV;

uniform sampler2D textureSampler;
uniform sampler2D depthTexture;
uniform sampler2D gbufferTexture;
uniform vec2 texelSize;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    float centerDepth = texture(depthTexture, vUV).r;
    vec3 normal = normalize(texture(gbufferTexture, vUV).rgb * 2.0 - 1.0);

    float occlusion = 0.0;

    for (int index = 0; index < 12; index++)
    {
        float angle = float(index) * 0.5235988; // 30 degrees
        float radius = 2.0 + 6.0 * fract(float(index) * 0.6180339);
        vec2 offset = vec2(cos(angle), sin(angle)) * radius * texelSize;

        float neighbourDepth = texture(depthTexture, vUV + offset).r;
        float difference = centerDepth - neighbourDepth;

        // A neighbour closer to the camera occludes this one slightly.
        occlusion += step(0.0008, difference) * smoothstep(0.004, 0.0, difference);
    }

    occlusion = clamp(occlusion / 12.0, 0.0, 1.0);

    // View-space normal: surfaces facing away from the camera are less noisy.
    float facing = clamp(normal.z, 0.0, 1.0);

    vec3 scene = texture(textureSampler, vUV).rgb;
    fragColor = vec4(scene * mix(1.0, 0.45, occlusion * facing), 1.0);
}
