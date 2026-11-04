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

// Output
layout(location = 0) out vec4 fragColor;

void main(void)
{
    // World-space vectors
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPos - vWorldPosition);

    // Fresnel
    float NdotV = max(dot(N, V), 0.0);

    float fresnel = pow(1.0 - NdotV, 3.0);

    // Colors
    vec3 baseColor = vec3(0.05, 0.1, 0.2);
    vec3 fresnelColor = vec3(0.0, 0.8, 1.0);

    // Final composition
    vec3 finalColor = mix(
        baseColor,
        fresnelColor,
        fresnel
    );

    fragColor = vec4(finalColor, 1.0);
}