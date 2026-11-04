#version 300 es
precision highp float;

// Vertex attributes
in vec3 position;
in vec3 normal;
in vec3 tangent;
in vec2 uv;
in vec2 uv2;
in vec4 color;

// Babylon.js uniforms
uniform mat4 world;
uniform mat4 view ;
uniform mat4 projection;
uniform mat3 normalMatrix;
uniform float time;

// Outputs
out vec3 vPosition;
out vec3 vWorldPosition;
out vec3 vNormal;
out vec3 vWorldNormal;
out vec3 vTangent;
out vec2 vUv;
out vec2 vUv2;
out vec4 vColor;

void main(void)
{
    // World-space position
    vec4 worldPosition = world * vec4(position, 1.0);

    vWorldPosition = worldPosition.xyz;

    // Transform normal into world space
    vWorldNormal = normalize(normalMatrix * normal);

    // Preserve local-space attributes
    vPosition = position;
    vNormal = normal;
    vTangent = tangent;
    vUv = uv;
    vUv2 = uv2;
    vColor = color;

    // Clip-space position
    gl_Position = projection * view * worldPosition;
}