#version 300 es
precision highp float;

// In attributes from the vertex shader
in vec3 vPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec2 vUv;
in vec2 vUv2;
in vec4 vColor;

// Built-in uniforms (from babylon.js engine)
uniform float time;
uniform vec3 cameraPos;
uniform vec3 lightDir;

// Out attributes to the next rendering pipeline stage
layout(location = 0) out vec4 fragColor;

void main(void) {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(lightDir);

  float ndl = max(dot(N, L), 0.0);

  vec3 albedo  = vec3(0.35, 0.55, 0.95);
  vec3 ambient = vec3(0.08, 0.08, 0.10);
  vec3 color   = ambient + albedo * ndl;

  fragColor = vec4(color, 1.0);
}