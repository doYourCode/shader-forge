#version 300 es
precision highp float;

// Depth fog: blend the image toward a fog colour with distance.
// `depthTexture.r` is linear view depth normalised to [0, 1]; convert it back
// to world units with cameraNear/cameraFar before using an exponential curve.

in vec2 vUV;

uniform sampler2D textureSampler;
uniform sampler2D depthTexture;
uniform float cameraNear;
uniform float cameraFar;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec3 scene = texture(textureSampler, vUV).rgb;
    float normalisedDepth = texture(depthTexture, vUV).r;
    float worldDepth = cameraNear + normalisedDepth * (cameraFar - cameraNear);

    // Exponential-squared fog. 0.035 is the density in inverse world units.
    float density = 0.035;
    float fog = 1.0 - exp(-worldDepth * worldDepth * density * density);

    vec3 fogColor = vec3(0.55, 0.68, 0.82);
    fragColor = vec4(mix(scene, fogColor, clamp(fog, 0.0, 1.0)), 1.0);
}
