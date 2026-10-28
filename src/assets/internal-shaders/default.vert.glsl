precision highp float;

attribute vec3 position;
attribute vec3 normal;

uniform mat4 worldViewProjection;
uniform mat4 normalMatrix;

varying vec3 vNormal;

void main(void) {
  gl_Position = worldViewProjection * vec4(position, 1.0);
  vNormal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
}