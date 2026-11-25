#version 300 es
precision highp float;

// Depth + normal edge detection: a cheap outline over the scene.
// The Sobel-style taps compare linear depth and view-space normals.

in vec2 vUV;

uniform sampler2D sceneColorTexture;
uniform sampler2D depthTexture;
uniform sampler2D normalTexture;

uniform vec2 resolution;
uniform vec2 texelSize;
uniform float cameraNear;
uniform float cameraFar;

layout(location = 0) out vec4 fragColor;

float depthAt(vec2 uv)
{
    return texture(depthTexture, uv).r;
}

vec3 normalAt(vec2 uv)
{
    return normalize(texture(normalTexture, uv).rgb * 2.0 - 1.0);
}

void main(void)
{
    vec2 stepUv = texelSize * 1.5;

    float depthCenter = depthAt(vUV);
    float depthLeft = depthAt(vUV - vec2(stepUv.x, 0.0));
    float depthRight = depthAt(vUV + vec2(stepUv.x, 0.0));
    float depthDown = depthAt(vUV - vec2(0.0, stepUv.y));
    float depthUp = depthAt(vUV + vec2(0.0, stepUv.y));

    float depthEdge = abs(depthLeft - depthRight) + abs(depthDown - depthUp);
    depthEdge = depthEdge / max(depthCenter, 1e-3);

    vec3 normalCenter = normalAt(vUV);
    vec3 normalLr = normalAt(vUV - vec2(stepUv.x, 0.0)) + normalAt(vUV + vec2(stepUv.x, 0.0));
    vec3 normalUd = normalAt(vUV - vec2(0.0, stepUv.y)) + normalAt(vUV + vec2(0.0, stepUv.y));
    float normalEdge = 1.0 - clamp(dot(normalCenter, normalize(normalLr + normalUd)), 0.0, 1.0);

    float edge = smoothstep(0.03, 0.12, depthEdge) + smoothstep(0.25, 0.6, normalEdge);
    edge = clamp(edge, 0.0, 1.0);

    vec3 scene = texture(sceneColorTexture, vUV).rgb;
    vec3 color = mix(scene, vec3(0.02, 0.02, 0.03), edge);

    fragColor = vec4(color, 1.0);
}
