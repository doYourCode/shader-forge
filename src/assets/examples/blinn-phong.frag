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

    float NdotL = max(dot(N, L), 0.0); // Lambertian diffuse term.

    /* Blinn's tweak on Phong: instead of mirroring the light and comparing it with
    the eye, it compares the half vector between light and eye with the normal.
    The half vector never leaves the hemisphere, so the highlight stays stable at
    grazing angles and reaches the edge of an object, which the Phong lobe does not.*/
    vec3 H = normalize(L + V);
    float specular = pow(max(dot(N, H), 0.0), shininess);

    vec3 diffuse = albedo * NdotL;
    vec3 highlight = specularColor * specular * NdotL;

    vec3 finalColor = diffuse + highlight;

    fragColor = vec4(finalColor, 1.0);
}
