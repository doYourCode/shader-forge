#version 300 es
precision highp float;

// Depth/normal edge detection over the surface post-effect G-buffer.
// `depthTexture` is normalised linear depth; the view-space normal is encoded
// in `gbufferTexture`.

in vec2 vUV;

uniform sampler2D textureSampler;
uniform sampler2D gbufferTexture;
uniform sampler2D depthTexture;
uniform vec2 texelSize;

layout(location = 0) out vec4 fragColor;

float depthAt(vec2 uv)
{
    return texture(depthTexture, uv).r;
}

vec3 normalAt(vec2 uv)
{
    return normalize(texture(gbufferTexture, uv).rgb * 2.0 - 1.0);
}

void main(void)
{
    vec2 stepUv = texelSize * 1.5;

    float depthEdge =
        abs(depthAt(vUV - vec2(stepUv.x, 0.0)) - depthAt(vUV + vec2(stepUv.x, 0.0))) +
        abs(depthAt(vUV - vec2(0.0, stepUv.y)) - depthAt(vUV + vec2(0.0, stepUv.y)));

    vec3 normalCenter = normalAt(vUV);
    vec3 normalNeighbours =
        normalAt(vUV - vec2(stepUv.x, 0.0)) +
        normalAt(vUV + vec2(stepUv.x, 0.0)) +
        normalAt(vUV - vec2(0.0, stepUv.y)) +
        normalAt(vUV + vec2(0.0, stepUv.y));
    float normalEdge = 1.0 - clamp(dot(normalCenter, normalize(normalNeighbours)), 0.0, 1.0);

    float edge = clamp(
        smoothstep(0.002, 0.02, depthEdge) + smoothstep(0.2, 0.55, normalEdge),
        0.0,
        1.0
    );

    vec3 scene = texture(textureSampler, vUV).rgb;
    fragColor = vec4(mix(scene, vec3(0.02, 0.02, 0.03), edge), 1.0);
}
