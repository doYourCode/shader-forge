#version 300 es
precision highp float;

// Lambert example - fragment stage.
//
// The oldest diffuse model: reflected radiance is proportional to N dot L
// only. It ignores the viewer, so the surface looks the same from every angle,
// which makes it the baseline the other lighting models are compared against.

in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec3 lightDir;

layout(location = 0) out vec4 fragColor;

// Material
const vec3 ALBEDO = vec3(0.72, 0.31, 0.22);
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

    float NdotL = max(dot(N, L), 0.0);

    // A unit-radiance light supplies PI at normal incidence, cancelling the
    // 1/PI of the Lambert BRDF: the brightest diffuse value is the albedo.
    vec3 diffuse = ALBEDO * NdotL;

    vec3 color = diffuse + ALBEDO * AMBIENT;

    fragColor = vec4(acesFilm(color), 1.0);
}
