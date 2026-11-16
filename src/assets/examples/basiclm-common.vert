#version 300 es
precision highp float;

in vec3 position; // Input attributes data from the mesh
in vec3 normal;   // file (residing the vertex buffer).

uniform mat4 world;         //
uniform mat4 view;          // Uniform data from 
uniform mat4 projection;    // the application.
uniform mat3 normalMatrix;  //

out vec3 vWorldPosition;    // Output data to the
out vec3 vWorldNormal;      // fragment shader.

void main(void)
{
    vec4 worldPosition = world * vec4(position, 1.0);

    vWorldPosition = worldPosition.xyz;                    // Position and normal data is sent
    vWorldNormal = normalize(normalMatrix * normal);    // in world space.

    gl_Position = projection * view * worldPosition;
}
