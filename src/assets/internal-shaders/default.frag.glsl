#version 300 es
precision highp float;

// Inputs from vertex shader
in vec3 vPosition;
in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vWorldNormal;
in vec3 vTangent;
in vec2 vUv;
in vec2 vUv2;
in vec4 vColor;

// Babylon.js uniforms
uniform float time;
uniform vec3 cameraPos;
uniform vec3 lightDir;
uniform samplerCube irradianceMap;
uniform samplerCube prefilteredEnvironmentMap;
uniform sampler2D brdfLUT;

// Output
layout(location = 0) out vec4 fragColor;

vec3 acesFilm(vec3 x);

void main(void)
{
    // World-space vectors
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(lightDir);
    vec3 V = normalize(cameraPos - vWorldPosition);

    // Fresnel
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 3.0);

    // Subtle environment reflection from the selected HDRI
    vec3 reflectionDir = reflect(-V, N);
    vec3 reflectionTerm = textureLod(prefilteredEnvironmentMap, reflectionDir, 1.0).rgb;
  
    vec3 diffuseTerm = texture(irradianceMap, vWorldNormal).rgb;

    vec3 finalColor = acesFilm(diffuseTerm + reflectionTerm * fresnel);

    fragColor = vec4(finalColor, 1.0);
}

vec3 acesFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}