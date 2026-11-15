#version 300 es
precision highp float;

// Blinn-Phong example - fragment stage.
//
// Blinn's tweak on Phong: instead of mirroring the light and comparing it with
// the eye, it compares the half vector between light and eye with the normal.
// The half vector never leaves the hemisphere, so the highlight stays stable at
// grazing angles and reaches the edge of an object, which the Phong lobe does
// not.
//
// Editable parameters (User data tab):
//   albedo        - color (vec3)
//   specularColor - color (vec3)
//   shininess     - float

in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec3 cameraPos;
uniform vec3 lightDir;

layout(location = 0) out vec4 fragColor;

// A little fill so the unlit side keeps its silhouette instead of going black.
const float AMBIENT = 0.03;

// Narkowicz's ACES fit, the same curve the built-in preview shader uses, so
// every example lands in the same display range.
vec3 acesFilm(vec3 x)
{
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main(void)
{
    vec3 N = normalize(vWorldNormal);
    // `lightDir` points from the surface toward the light, in world space.
    vec3 L = normalize(lightDir);
    vec3 V = normalize(cameraPos - vWorldPosition);

    float NdotL = max(dot(N, L), 0.0);

    // Half vector: the normal an ideal microfacet needs to mirror L into V.
    vec3 H = normalize(L + V);
    float specular = pow(max(dot(N, H), 0.0), shininess);

    vec3 diffuse = albedo * NdotL;
    vec3 highlight = specularColor * specular * NdotL;

    vec3 color = diffuse + highlight + albedo * AMBIENT;

    fragColor = vec4(acesFilm(color), 1.0);
}
