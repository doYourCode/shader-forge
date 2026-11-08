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
uniform samplerCube environmentMap;

// Output
layout(location = 0) out vec4 fragColor;

void main(void)
{
    // World-space vectors
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(lightDir);

    vec3 V = normalize(cameraPos - vWorldPosition);

    // Fresnel
    float NdotV = max(dot(N, V), 0.0);

    float fresnel = pow(1.0 - NdotV, 3.0);

    // Half lambert term
    float NdotL = max(dot(N, L) * 0.5 + 0.5, 0.0);

    // Colors
    vec3 baseColor = vec3(0.05, 0.1, 0.2);
    vec3 fresnelColor = vec3(0.0, 0.8, 1.0);

    // Final composition
    vec3 finalColor = mix(
        baseColor,
        fresnelColor,
        max(NdotL, fresnel)
    );

    // Subtle environment reflection from the selected HDRI
    vec3 reflectionDir = reflect(-V, N);
    vec3 environmentColor = textureLod(environmentMap, reflectionDir, 7.5).rgb;
    //environmentColor = environmentColor / (environmentColor + vec3(1.0));

    float reflectionAmount = 0.1 + fresnel * 0.30;
    finalColor = mix(finalColor, environmentColor, reflectionAmount);

    fragColor = vec4(finalColor, 1.0);
}