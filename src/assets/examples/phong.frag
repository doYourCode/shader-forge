#version 300 es
precision highp float;

// Phong example - fragment stage.
//
// Phong adds a specular lobe on top of Lambert: the light is mirrored around
// the normal and the highlight is a power of the angle between that reflection
// vector and the eye. A larger SHININESS gives a tighter, dimmer highlight.

in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec3 cameraPos;
uniform vec3 lightDir;

layout(location = 0) out vec4 fragColor;

// Material
const vec3 ALBEDO = vec3(0.72, 0.31, 0.22);
const vec3 SPECULAR_COLOR = vec3(0.35);
const float SHININESS = 48.0;
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

    // Mirror the light around the normal, then compare it with the eye.
    vec3 R = reflect(-L, N);
    float specular = pow(max(dot(R, V), 0.0), SHININESS);

    vec3 diffuse = ALBEDO * NdotL;
    vec3 highlight = SPECULAR_COLOR * specular * NdotL;

    vec3 color = diffuse + highlight + ALBEDO * AMBIENT;

    fragColor = vec4(acesFilm(color), 1.0);
}
