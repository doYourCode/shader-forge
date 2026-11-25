#version 300 es
precision highp float;

// Vertex displacement: move each vertex along its normal by a wave.
// `amplitude` is a vertex-stage user uniform; `time` comes from the ABI.

in vec3 position;
in vec3 normal;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform mat3 normalMatrix;
uniform float time;

out vec3 vWorldPosition;
out vec3 vWorldNormal;
out float vHeight;

void main(void)
{
    float wave = sin(position.x * 4.0 + time * 2.0) * cos(position.z * 4.0);
    vec3 displaced = position + normal * wave * amplitude;

    vec4 worldPosition = world * vec4(displaced, 1.0);

    vWorldPosition = worldPosition.xyz;
    // Approximate normal: the true displaced normal needs neighbour samples.
    vWorldNormal = normalize(normalMatrix * normal);
    vHeight = wave;

    gl_Position = projection * view * worldPosition;
}
