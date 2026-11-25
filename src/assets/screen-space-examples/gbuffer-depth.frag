#version 300 es
precision highp float;

// G-buffer visualiser: linear view-space depth in world units.
// Near surfaces are dark, far surfaces are bright; the background is black.

in vec2 vUV;

uniform sampler2D sceneColorTexture;
uniform sampler2D depthTexture;
uniform sampler2D normalTexture;

uniform vec2 resolution;
uniform vec2 texelSize;
uniform float cameraNear;
uniform float cameraFar;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    float depth = texture(depthTexture, vUV).r;

    // The background is the far plane; treat it separately.
    float background = step(cameraFar - 0.001, depth);
    float linear01 = clamp((depth - cameraNear) / (cameraFar - cameraNear), 0.0, 1.0);

    // A gamma curve makes the near range easier to read.
    float shade = pow(linear01, 0.45);
    vec3 color = mix(vec3(0.02, 0.05, 0.12), vec3(0.95, 0.96, 1.0), shade);
    color = mix(color, vec3(0.0), background);

    fragColor = vec4(color, 1.0);
}
