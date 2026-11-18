#version 300 es
precision highp float;

// Depth prepass for view-space effects. Rendered into a single-channel float
// target (R32F when the device can render to float, R8 otherwise) before the
// camera, so effects get linear depth that is independent of the colour pass.

in vec3 position;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;

out float vViewDepth;

void main(void)
{
    vec4 viewPosition = view * world * vec4(position, 1.0);

    // Babylon's preview scene is left-handed, so visible fragments have a
    // positive view-space Z (right-handed scenes have a negative one). The
    // absolute value keeps the pass correct for either convention.
    vViewDepth = abs(viewPosition.z);

    gl_Position = projection * viewPosition;
}
