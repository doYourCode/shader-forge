#version 300 es
precision highp float;

// Writes linear view depth normalised to the camera clip range:
//   0 = cameraNear, 1 = cameraFar (the cleared background).
// Effects reconstruct world units with:
//   viewDepth = cameraNear + depth * (cameraFar - cameraNear)

in float vViewDepth;

uniform float cameraNear;
uniform float cameraFar;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    float range = max(cameraFar - cameraNear, 1e-5);
    float depth = (vViewDepth - cameraNear) / range;

    fragColor = vec4(clamp(depth, 0.0, 1.0), 0.0, 0.0, 1.0);
}
