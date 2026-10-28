export const defaultVertexShader = `
precision highp float;

attribute vec3 position;
attribute vec3 normal;

uniform mat4 worldViewProjection;
uniform mat4 normalMatrix;

varying vec3 vNormal;

void main(void) {
  vec4 worldPos = worldViewProjection * vec4(position, 1.0);
  gl_Position = worldPos;
  vNormal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
}
`.trim();

export const defaultFragmentShader = `
precision highp float;

varying vec3 vNormal;

void main(void) {
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
  float ndl = max(dot(normalize(vNormal), lightDir), 0.0);

  vec3 base = vec3(0.35, 0.55, 0.95);
  vec3 ambient = vec3(0.12, 0.14, 0.18);
  vec3 color = ambient + base * (0.25 + 0.75 * ndl);

  gl_FragColor = vec4(color, 1.0);
}
`.trim();

export const defaultUniformsDoc = `
// Read-only reference for Babylon ShaderMaterial uniforms.

worldViewProjection : mat4  // vertex: final clip-space transform
normalMatrix        : mat4  // vertex: inverse-transpose world matrix
world               : mat4  // mesh world matrix
worldView           : mat4  // world * view
view                : mat4  // camera view matrix
projection          : mat4  // camera projection matrix
time                : float // optional, set by host if needed
`.trim();

export const defaultIoDoc = `
// Read-only reference for Babylon ShaderMaterial attributes / varyings.

// Vertex inputs
position : vec3
normal   : vec3
uv       : vec2

// Vertex outputs / fragment inputs
vNormal  : vec3
`.trim();