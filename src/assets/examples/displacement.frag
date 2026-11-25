#version 300 es
precision highp float;

// Fragment stage for the displacement example. The vertex stage forwards the
// wave height in vHeight, which tints the crests and the troughs differently.

in vec3 vWorldPosition;
in vec3 vWorldNormal;
in float vHeight;

uniform vec3 lightDir;

out vec4 fragColor;

void main(void)
{
    vec3 normal = normalize(vWorldNormal);
    float NdotL = max(dot(normal, normalize(lightDir)), 0.0);

    vec3 low = albedo * 0.35;
    vec3 high = albedo;
    vec3 base = mix(low, high, smoothstep(-1.0, 1.0, vHeight));

    fragColor = vec4(base * (0.2 + 0.8 * NdotL), 1.0);
}
