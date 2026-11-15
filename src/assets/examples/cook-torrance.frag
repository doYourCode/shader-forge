#version 300 es
precision highp float;

// Cook-Torrance example - fragment stage.
//
// The microfacet specular model used by every modern renderer:
//   D  GGX/Trowbridge-Reitz  - how many microfacets face the half vector;
//   G  Schlick-GGX Smith     - how much of the light survives shadowing;
//   F  Schlick               - how much is reflected rather than refracted.
// Scaled by what is not reflected (kD = 1 - F) it gives an energy-conserving
// direct light on top of the Lambert diffuse.

in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec3 cameraPos;
uniform vec3 lightDir;

layout(location = 0) out vec4 fragColor;

const float PI = 3.14159265359;

// Material
const vec3 BASE_COLOR = vec3(0.72, 0.31, 0.22);
const float ROUGHNESS = 0.35;
const float METALLIC = 0.0;
// Fresnel reflectance of a dielectric at normal incidence.
const float DIELECTRIC_F0 = 0.04;
// Radiance of the directional light. Values above 1 push the highlight into
// the ACES shoulder, the way a real light source does.
const float LIGHT_RADIANCE = 3.0;
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

// GGX normal distribution: D.
float distributionGGX(float NdotH, float roughness)
{
    float alpha = roughness * roughness;
    float alpha2 = alpha * alpha;
    float denominator = NdotH * NdotH * (alpha2 - 1.0) + 1.0;
    return alpha2 / max(PI * denominator * denominator, 1e-4);
}

// Smith masking-shadowing for one direction, with the direct-light k.
float geometrySchlickGGX(float NdotX, float k)
{
    return NdotX / (NdotX * (1.0 - k) + k);
}

// Combined Smith geometry: G.
float geometrySmith(float NdotV, float NdotL, float roughness)
{
    float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
    return geometrySchlickGGX(NdotV, k) * geometrySchlickGGX(NdotL, k);
}

// Schlick's Fresnel approximation: F.
vec3 fresnelSchlick(float VdotH, vec3 F0)
{
    float factor = pow(max(1.0 - VdotH, 0.0), 5.0);
    return F0 + (vec3(1.0) - F0) * factor;
}

void main(void)
{
    vec3 N = normalize(vWorldNormal);
    // `lightDir` points from the surface toward the light, in world space.
    vec3 L = normalize(lightDir);
    vec3 V = normalize(cameraPos - vWorldPosition);
    vec3 H = normalize(L + V);

    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 1e-3);
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);

    // Metals tint their reflection with the base colour; dielectrics do not.
    vec3 F0 = mix(vec3(DIELECTRIC_F0), BASE_COLOR, METALLIC);

    vec3 F = fresnelSchlick(VdotH, F0);
    float D = distributionGGX(NdotH, ROUGHNESS);
    float G = geometrySmith(NdotV, NdotL, ROUGHNESS);

    // The 4 * NdotL * NdotV denominator is the microfacet BRDF normalisation.
    vec3 specular = D * G * F / (4.0 * NdotL * NdotV + 1e-3);

    vec3 kD = (vec3(1.0) - F) * (1.0 - METALLIC);
    vec3 diffuse = kD * BASE_COLOR / PI;

    vec3 color = (diffuse + specular) * LIGHT_RADIANCE * NdotL;
    color += BASE_COLOR * AMBIENT;

    fragColor = vec4(acesFilm(color), 1.0);
}
