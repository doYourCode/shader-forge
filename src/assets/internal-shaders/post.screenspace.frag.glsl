#version 300 es
precision highp float;

// Screen-space post effect.
//
// This fragment runs as a fullscreen pass after the opaque PBR scene has been
// rendered into a linear HDR target. Each effect receives the output of the
// previous one, so the stack reads top to bottom. The display pass applies the
// output transform and composites the separate transparent overlay.
//
// Scene G-buffer
//   textureSampler       linear HDR output of the previous pass (first pass:
//                        the opaque scene colour).
//   sceneColorTexture    the original, unmodified HDR scene colour. Use this
//                        for effects such as SSR/SSGI that must not see the
//                        previous effect's result.
//   depthTexture.r       linear view-space depth in world units (positive
//                        distance). Background is the far plane.
//   normalTexture.rgb    view-space normal, encoded as n * 0.5 + 0.5.
//                        normalTexture.a is 1 on geometry, 0 on background.
//   albedoTexture.rgb    sqrt-encoded linear base colour; use gbufferAlbedo()
//                        below. albedoTexture.a is the geometry mask.
//   materialTexture.rgb  PBR specular F0.
//   materialTexture.a    glossiness (1 - roughness). This is the
//                        metallic/roughness model: use gbufferRoughness() and
//                        gbufferMetallic() below.
//   velocityTexture.rg   linear UV-space motion vectors (may be negative).
//
// Uniforms
//   resolution, texelSize, time, cameraNear, cameraFar, cameraPosition,
//   projection, inverseProjection, view, inverseView, viewProjection,
//   inverseViewProjection, previousViewProjection, frameIndex, deltaTime.
//
// Declare your own uniforms in the "User data" tab and target the "Post"
// stage so they are injected here and bound every frame.

in vec2 vUV;

uniform sampler2D textureSampler;
uniform sampler2D sceneColorTexture;
uniform sampler2D depthTexture;
uniform sampler2D normalTexture;
uniform sampler2D albedoTexture;
uniform sampler2D materialTexture;
uniform sampler2D velocityTexture;

uniform vec2 resolution;
uniform vec2 texelSize;
uniform float time;
uniform float cameraNear;
uniform float cameraFar;
uniform vec3 cameraPosition;
uniform mat4 projection;
uniform mat4 inverseProjection;
uniform mat4 view;
uniform mat4 inverseView;
uniform mat4 viewProjection;
uniform mat4 inverseViewProjection;
uniform mat4 previousViewProjection;
uniform float frameIndex;
uniform float deltaTime;

layout(location = 0) out vec4 fragColor;

/** Linear albedo from Babylon's sqrt-encoded albedo attachment. */
vec3 gbufferAlbedo(vec2 uv)
{
    vec3 encoded = texture(albedoTexture, uv).rgb;
    return encoded * encoded;
}

/** Roughness reconstructed from the PBR reflectivity attachment. */
float gbufferRoughness(vec2 uv)
{
    return clamp(1.0 - texture(materialTexture, uv).a, 0.0, 1.0);
}

/** Metallic reconstructed from F0 versus albedo (dielectric F0 is 0.04). */
float gbufferMetallic(vec2 uv)
{
    vec3 f0 = texture(materialTexture, uv).rgb;
    vec3 albedo = gbufferAlbedo(uv);
    float dielectric = 0.04;
    float maxF0 = max(max(f0.r, f0.g), f0.b);
    float maxAlbedo = max(max(albedo.r, albedo.g), albedo.b);
    return clamp(
        (maxF0 - dielectric) / max(maxAlbedo - dielectric, 1e-3),
        0.0,
        1.0
    );
}

/** Reconstructs view-space position from the linear depth buffer. */
vec3 gbufferViewPosition(vec2 uv)
{
    float depth = texture(depthTexture, uv).r;
    vec4 clip = vec4(uv * 2.0 - 1.0, 0.5, 1.0);
    vec4 viewPosition = inverseProjection * clip;
    viewPosition.xyz /= max(abs(viewPosition.w), 1e-6);
    return viewPosition.xyz * (depth / max(abs(viewPosition.z), 1e-6));
}

void main(void)
{
    vec3 color = texture(textureSampler, vUV).rgb;

    // Passthrough: replace the line below with your effect.
    fragColor = vec4(color, 1.0);
}
