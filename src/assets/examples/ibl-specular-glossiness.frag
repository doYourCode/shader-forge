#version 300 es
precision highp float;

// IBL (specular / glossiness) example - fragment stage.
//
// The same split-sum environment lighting as the metalness example, but with
// the older specular workflow: the diffuse and the specular colour are authored
// independently instead of being derived from one albedo plus a metalness mask.
// Glossiness is the inverse of roughness, so it selects the sharp end of the
// prefiltered cubemap.
//
// Editable parameters (User data tab):
//   diffuseColor  - color (vec3)
//   specularColor - color (vec3), used as F0
//   glossiness    - float, 0 = fully rough, 1 = mirror

in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec3 cameraPos;
uniform samplerCube irradianceMap;
uniform samplerCube prefilteredEnvironmentMap;
uniform sampler2D brdfLUT;

layout(location = 0) out vec4 fragColor;

const float ENV_MAX_LOD = 9.0;
const float MIN_ROUGHNESS = 0.02;

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
    vec3 V = normalize(cameraPos - vWorldPosition);
    vec3 R = reflect(-V, N);

    float NdotV = max(dot(N, V), 1e-3);
    float roughness = clamp(1.0 - glossiness, MIN_ROUGHNESS, 1.0);

    vec3 F0 = specularColor;
    // Whatever is not reflected at the surface is still available to diffuse.
    vec3 kD = vec3(1.0) - F0;

    vec3 irradiance = texture(irradianceMap, N).rgb;
    vec3 radiance = textureLod(
        prefilteredEnvironmentMap,
        R,
        roughness * ENV_MAX_LOD
    ).rgb;

    // Split-sum: R is the response at F0 = 0 (grazing only) and G the response
    // at F0 = 1, so mixing them by F0 integrates Fresnel over the hemisphere.
    vec2 brdf = texture(brdfLUT, vec2(NdotV, roughness)).rg;
    vec3 specular = radiance * mix(vec3(brdf.r), vec3(brdf.g), F0);

    vec3 diffuse = kD * diffuseColor * irradiance;

    fragColor = vec4(acesFilm(diffuse + specular), 1.0);
}
