#version 300 es
precision highp float;

in vec3 position;
in vec3 normal;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform mat3 normalMatrix;

out vec3 vWorldPosition;
out vec3 vWorldNormal;

void main(void)
{
    vec4 worldPosition = world * vec4(position, 1.0);

    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(normalMatrix * normal);

    gl_Position = projection * view * worldPosition;
}
