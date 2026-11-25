#version 300 es
precision highp float;

// G-buffer visualiser: roughness and metallic.
// materialTexture.rgb is specular F0; materialTexture.a is glossiness.
// Roughness = 1 - glossiness; metallic is reconstructed from F0 vs albedo.

in vec2 vUV;

uniform sampler2D albedoTexture;
uniform sampler2D materialTexture;
uniform sampler2D normalTexture;
uniform sampler2D depthTexture;

uniform vec2 resolution;
uniform vec2 texelSize;

layout(location = 0) out vec4 fragColor;

vec3 gbufferAlbedo(vec2 uv)
{
    vec3 encoded = texture(albedoTexture, uv).rgb;
    return encoded * encoded;
}

float gbufferMetallic(vec2 uv)
{
    vec3 f0 = texture(materialTexture, uv).rgb;
    vec3 albedo = gbufferAlbedo(uv);
    float dielectric = 0.04;
    float maxF0 = max(max(f0.r, f0.g), f0.b);
    float maxAlbedo = max(max(albedo.r, albedo.g), albedo.b);
    return clamp((maxF0 - dielectric) / max(maxAlbedo - dielectric, 1e-3), 0.0, 1.0);
}

void main(void)
{
    vec4 material = texture(materialTexture, vUV);
    float roughness = clamp(1.0 - material.a, 0.0, 1.0);
    float metallic = gbufferMetallic(vUV);
    float mask = texture(normalTexture, vUV).a;

    // Roughness in red, metallic in green, F0 average in blue.
    vec3 color = vec3(roughness, metallic, dot(material.rgb, vec3(0.3333)));
    color *= mask;

    fragColor = vec4(color, 1.0);
}
