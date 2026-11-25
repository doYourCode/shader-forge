#version 300 es
precision highp float;

// G-buffer visualiser: linear albedo.
// albedoTexture.rgb is sqrt-encoded, so square it to get linear colour.

in vec2 vUV;

uniform sampler2D albedoTexture;
uniform sampler2D normalTexture;
uniform sampler2D depthTexture;

uniform vec2 resolution;
uniform vec2 texelSize;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec4 albedo = texture(albedoTexture, vUV);
    vec3 linearAlbedo = albedo.rgb * albedo.rgb;
    vec3 color = linearAlbedo * albedo.a;

    fragColor = vec4(color, 1.0);
}
