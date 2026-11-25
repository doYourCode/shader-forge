#version 300 es
precision highp float;

// Screen-space ambient occlusion (SSAO), simplified for teaching.
// For each pixel, look at neighbours in a view-space disc and count how many
// are closer to the camera than the pixel itself.

in vec2 vUV;

uniform sampler2D sceneColorTexture;
uniform sampler2D depthTexture;
uniform sampler2D normalTexture;

uniform vec2 resolution;
uniform vec2 texelSize;
uniform float cameraNear;
uniform float cameraFar;
uniform mat4 inverseProjection;

layout(location = 0) out vec4 fragColor;

vec3 viewPosition(vec2 uv)
{
    float depth = texture(depthTexture, uv).r;
    vec4 clip = vec4(uv * 2.0 - 1.0, 0.5, 1.0);
    vec4 view = inverseProjection * clip;
    view.xyz /= max(abs(view.w), 1e-6);
    return view.xyz * (depth / max(abs(view.z), 1e-6));
}

void main(void)
{
    float depth = texture(depthTexture, vUV).r;
    vec3 position = viewPosition(vUV);
    vec3 normal = normalize(texture(normalTexture, vUV).rgb * 2.0 - 1.0);

    float radius = 0.55;
    float bias = 0.025;
    float occlusion = 0.0;
    float samples = 12.0;

    for (int index = 0; index < 12; index++)
    {
        float angle = (float(index) / samples) * 6.2831853;
        float ring = 0.25 + 0.75 * fract(float(index) * 0.6180339);
        vec2 offset = vec2(cos(angle), sin(angle)) * ring * radius * texelSize * 256.0;

        vec3 neighbour = viewPosition(vUV + offset);
        vec3 delta = neighbour - position;
        float distance = length(delta);

        // Only count neighbours that lie inside the radius and in front of the
        // tangent plane, so the surface does not occlude itself.
        float inRadius = step(distance, radius);
        float inFront = step(bias, dot(-delta, normal) / max(distance, 1e-4));
        occlusion += inRadius * inFront;
    }

    occlusion /= samples;
    occlusion = 1.0 - occlusion;

    vec3 scene = texture(sceneColorTexture, vUV).rgb;
    fragColor = vec4(scene * mix(0.45, 1.0, occlusion), 1.0);
}
