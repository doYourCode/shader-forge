#version 300 es
precision highp float;

in vec3 vNormal;

layout(location = 0) out vec4 fragColor;

void main(void) {
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
  float ndl = max(dot(normalize(vNormal), lightDir), 0.0);

  vec3 base = vec3(0.35, 0.55, 0.95);
  vec3 ambient = vec3(0.12, 0.14, 0.18);
  vec3 color = ambient + base * (0.25 + 0.75 * ndl);

  fragColor = vec4(color, 1.0);
}
