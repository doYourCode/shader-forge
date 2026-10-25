varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vNormal = normalize(normalMatrix * normal);

    vec4 modelPosition = modelViewMatrix * vec4(position, 1.0);
    vPosition = modelPosition.xyz;

    gl_Position = projectionMatrix * modelPosition;
}