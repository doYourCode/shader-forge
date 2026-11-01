#version 300 es
precision highp float;

// In vertex attributes from the engine
in vec3 position;
in vec3 normal;
in vec3 tangent;
in vec2 uv;
in vec2 uv2;
in vec4 color;

// Built-in uniforms (from babylon.js engine)
uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform float time;

// Out attributes to the fragment shader
out vec3 vPosition;
out vec3 vNormal;
out vec3 vTangent;
out vec2 vUv;
out vec2 vUv2;
out vec4 vColor;

void main(void)
{
  gl_Position = (projection * view * world) * vec4(position, 1.0);

  vPosition = position;
  vNormal = normal;
  vTangent = tangent;
  vUv = uv;
  vUv2 = uv2;
  vColor = color;
}