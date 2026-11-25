#version 300 es
precision highp float;

// G-buffer visualiser: motion vectors.
// velocityTexture.rg stores UV-space motion; positive x is right, positive y up.

in vec2 vUV;

uniform sampler2D velocityTexture;
uniform sampler2D normalTexture;
uniform sampler2D depthTexture;

uniform vec2 resolution;
uniform vec2 texelSize;
uniform float cameraFar;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec2 velocity = texture(velocityTexture, vUV).rg;
    float mask = texture(normalTexture, vUV).a;

    // Amplify tiny per-frame motion so the direction is visible.
    vec3 color = vec3(0.5 + velocity * 40.0, 0.5);
    color *= mask;

    fragColor = vec4(color, 1.0);
}
