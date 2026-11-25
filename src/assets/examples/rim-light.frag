#version 300 es
precision highp float;

// Rim light: add a bright edge where the surface turns away from the camera.
// The falloff is a Fresnel-like term, not a second light.

in vec3 vWorldPosition;
in vec3 vWorldNormal;

uniform vec3 cameraPos;
uniform vec3 lightDir;

out vec4 fragColor;

void main(void)
{
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPos - vWorldPosition);
    float NdotL = max(dot(normal, normalize(lightDir)), 0.0);

    // 1 - N dot V is 1 at grazing angles and 0 head-on.
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), rimPower);

    vec3 color = albedo * (0.12 + 0.88 * NdotL) + rimColor * rim;

    fragColor = vec4(color, 1.0);
}
