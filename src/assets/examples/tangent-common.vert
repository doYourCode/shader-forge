#version 300 es
precision highp float;

// Shared vertex stage for normal mapping and other tangent-space effects.
// It forwards the world-space tangent frame the fragment stage needs.

in vec3 position;
in vec3 normal;
in vec3 tangent;
in vec2 uv;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform mat3 normalMatrix;

out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec3 vWorldTangent;
out vec2 vUv;

void main(void)
{
    vec4 worldPosition = world * vec4(position, 1.0);

    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(normalMatrix * normal);
    vWorldTangent = normalize(normalMatrix * tangent);
    vUv = uv;

    gl_Position = projection * view * worldPosition;
}
