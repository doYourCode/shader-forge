#version 300 es
precision highp float;

// Last pass of the screen-space chain: composite the transparent overlay,
// apply the output transform, or show a G-buffer debug view.
//
// toneMappingMode: 0 = none, 1 = Reinhard, 2 = ACES filmic.
// debugMode:       0 = final image, see GBUFFER_DEBUG_MODES for the others.

in vec2 vUV;

uniform sampler2D textureSampler;       // HDR output of the last user pass
uniform sampler2D sceneColorTexture;    // original HDR opaque scene colour
uniform sampler2D depthTexture;
uniform sampler2D normalTexture;
uniform sampler2D albedoTexture;
uniform sampler2D materialTexture;
uniform sampler2D velocityTexture;
uniform sampler2D transparentTexture;

uniform vec2 resolution;
uniform vec2 texelSize;
uniform float toneMappingMode;
uniform float debugMode;

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

vec3 outputTransform(vec3 color)
{
    if (toneMappingMode > 1.5) {
        color = acesFilm(color);
    } else if (toneMappingMode > 0.5) {
        color = color / (1.0 + color);
    }

    return linearToSrgb(clamp(color, 0.0, 1.0));
}

float gbufferRoughness(vec2 uv)
{
    return clamp(1.0 - texture(materialTexture, uv).a, 0.0, 1.0);
}

float gbufferMetallic(vec2 uv)
{
    vec3 f0 = texture(materialTexture, uv).rgb;
    vec3 albedo = texture(albedoTexture, uv).rgb;
    float dielectric = 0.04;
    float maxF0 = max(max(f0.r, f0.g), f0.b);
    float maxAlbedo = max(max(albedo.r, albedo.g), albedo.b);
    return clamp(
        (maxF0 - dielectric) / max(maxAlbedo - dielectric, 1e-3),
        0.0,
        1.0
    );
}

float geometryMask(vec2 uv)
{
    return step(0.5, texture(normalTexture, uv).a);
}

vec3 debugColor()
{
    if (debugMode < 1.5) {
        return acesFilm(texture(sceneColorTexture, vUV).rgb);
    }

    if (debugMode < 2.5) {
        float depth = texture(depthTexture, vUV).r;
        return vec3(1.0 - exp(-max(depth, 0.0) * 0.05));
    }

    if (debugMode < 3.5) {
        return texture(normalTexture, vUV).rgb;
    }

    if (debugMode < 4.5) {
        vec3 albedo = texture(albedoTexture, vUV).rgb;
        return albedo * albedo; // the prepass stores sqrt(albedo)
    }

    if (debugMode < 5.5) {
        return (
            vec3(gbufferRoughness(vUV), gbufferMetallic(vUV), 0.5) *
            geometryMask(vUV)
        );
    }

    if (debugMode < 6.5) {
        vec2 velocity = texture(velocityTexture, vUV).rg;
        return (
            vec3(clamp(velocity * 10.0 + 0.5, 0.0, 1.0), 0.0) *
            geometryMask(vUV)
        );
    }

    return texture(transparentTexture, vUV).rgb;
}

void main(void)
{
    if (debugMode > 0.5) {
        fragColor = vec4(linearToSrgb(clamp(debugColor(), 0.0, 1.0)), 1.0);
        return;
    }

    vec4 overlay = texture(transparentTexture, vUV);
    vec3 color = texture(textureSampler, vUV).rgb;
    color = overlay.rgb + color * (1.0 - overlay.a);

    fragColor = vec4(outputTransform(color), 1.0);
}
