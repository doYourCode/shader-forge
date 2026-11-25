#version 300 es
precision highp float;

// G-buffer visualiser: view-space normals.
// normalTexture.rgb stores n * 0.5 + 0.5; alpha is the geometry mask.

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

void main(void)
{
    vec4 normal = texture(normalTexture, vUV);
    vec3 decoded = normalize(normal.rgb * 2.0 - 1.0);
    vec3 color = decoded * 0.5 + 0.5;

    // Darken the background so the mask is visible.
    color *= normal.a;

    fragColor = vec4(color, 1.0);
}
