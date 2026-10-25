uniform vec3 color;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDirection = normalize(vec3(0.5, 0.8, 1.0));

    float diffuse = max(dot(normal, lightDirection), 0.0);
    float ambient = 0.2;

    vec3 finalColor = color * (ambient + diffuse * 0.8);

    gl_FragColor = vec4(finalColor, 1.0);
}