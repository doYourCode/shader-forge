#version 300 es
precision highp float;

in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec3 cameraPos;
uniform vec3 lightDir;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(lightDir);
    vec3 V = normalize(cameraPos - vWorldPosition);

    float NdotL = max(dot(N, L), 0.0); // Lambertian diffuse term

    /* Phong adds a specular lobe on top of Lambert: the light is mirrored around
    the normal and the highlight is a power of the angle between that reflection
    vector and the eye. A larger shininess gives a tighter, dimmer highlight. */
    vec3 R = reflect(-L, N);
    float specular = pow(max(dot(R, V), 0.0), shininess);

    vec3 diffuse = albedo * NdotL;
    vec3 highlight = specularColor * specular * NdotL;

    vec3 finalColor = diffuse + highlight;

    fragColor = vec4(finalColor, 1.0);
}
