#version 300 es
precision highp float;

// IBL (metalness / roughness) example - fragment stage.
//
// Split-sum image-based lighting, the glTF metallic workflow:
//   * diffuse  <- the irradiance cubemap (already cosine-convolved);
//   * specular <- the GGX-prefiltered radiance cubemap, where roughness picks
//                 the mip level, scaled by the pre-integrated BRDF LUT.
// METALLIC moves F0 from the dielectric 0.04 to the base colour itself (which
// leaves no diffuse), ROUGHNESS widens the reflection.
//
// The bundled environments are 512x512 cubemaps baked with a full mip chain,
// so the roughest reflection lives at LOD 9.

in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec3 cameraPos;
uniform samplerCube irradianceMap;
uniform samplerCube prefilteredEnvironmentMap;
uniform sampler2D brdfLUT;

layout(location = 0) out vec4 fragColor;

const float ENV_MAX_LOD = 9.0;

// Material
const vec3 BASE_COLOR = vec3(0.85, 0.36, 0.24);
const float METALLIC = 1.0;
const float ROUGHNESS = 0.25;
// Fresnel reflectance of a dielectric at normal incidence.
const float DIELECTRIC_F0 = 0.04;

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

    vec3 F0 = mix(vec3(DIELECTRIC_F0), BASE_COLOR, METALLIC);
    // Whatever is not reflected at the surface is still available to diffuse.
    vec3 kD = vec3(1.0) - F0;

    // Diffuse: the cosine-convolved environment.
    vec3 irradiance = texture(irradianceMap, N).rgb;
    // Specular: the prefiltered environment at the mip matching the roughness.
    vec3 radiance = textureLod(
        prefilteredEnvironmentMap,
        R,
        ROUGHNESS * ENV_MAX_LOD
    ).rgb;

    // Split-sum: R is the response at F0 = 0 (grazing only) and G the response
    // at F0 = 1, so mixing them by F0 integrates Fresnel over the hemisphere.
    vec2 brdf = texture(brdfLUT, vec2(NdotV, ROUGHNESS)).rg;
    vec3 specular = radiance * mix(vec3(brdf.r), vec3(brdf.g), F0);

    vec3 diffuse = kD * BASE_COLOR * irradiance;

    fragColor = vec4(acesFilm(diffuse + specular), 1.0);
}
