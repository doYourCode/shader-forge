#version 300 es
precision highp float;

// Normal prepass for view-space effects. Rendered into an off-screen target
// before the camera; depth has its own dedicated pass and texture.

in vec3 position;
in vec3 normal;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform mat3 normalMatrix;

out vec3 vViewNormal;

void main(void)
{
    vec4 worldPosition = world * vec4(position, 1.0);
    vec4 viewPosition = view * worldPosition;

    // `normalMatrix` is the world-space inverse transpose; the view matrix is
    // orthonormal, so rotating the world normal into view space keeps it unit.
    vViewNormal = normalize(mat3(view) * (normalMatrix * normal));

    gl_Position = projection * viewPosition;
}
