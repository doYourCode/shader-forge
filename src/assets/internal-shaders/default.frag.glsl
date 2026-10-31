#version 300 es
precision highp float;

in vec3 vNormal;

layout(location = 0) out vec4 fragColor;

void main(void) {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(vec3(0.5, 1.0, 0.3));

  float ndl = max(dot(N, L), 0.0);

  vec3 albedo  = vec3(0.35, 0.55, 0.95);
  vec3 ambient = vec3(0.08, 0.08, 0.10);
  vec3 color   = ambient + albedo * ndl;

  fragColor = vec4(color, 1.0);
}