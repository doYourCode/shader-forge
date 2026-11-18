#version 300 es
precision highp float;

// View-space post effect.
//
// This fragment runs as a fullscreen pass after the scene is rendered into a
// linear colour target. Each effect receives the output of the previous one,
// so the stack reads top to bottom. Return linear HDR colour; the display
// pass applies the output transform chosen in the effect stack.
//
// Inputs
//   textureSampler       linear colour produced by the previous pass.
//   gbufferTexture.rgb   view-space normal, encoded as n * 0.5 + 0.5.
//   gbufferTexture.a     reserved (1 on geometry, 0 on the cleared background).
//   depthTexture.r       linear view depth normalised to the clip range:
//                        0 = cameraNear, 1 = cameraFar and the background.
//                        World units: cameraNear + r * (cameraFar - cameraNear).
//   resolution           render target size in pixels.
//   texelSize            1.0 / resolution, handy for screen-space taps.
//   time                 seconds since the preview started.
//   cameraNear/Far       camera clip planes, in world units.
//   cameraPosition       camera position in world space.
//   projection           camera projection matrix.
//   inverseProjection    inverse projection, for depth reconstruction.
//   view                 camera view matrix (world -> view space).
//   inverseView          inverse view matrix (view -> world space).
//
// Declare your own uniforms in the "User data" tab and target the
// "Post effect" stage so they are injected here and bound every frame.

in vec2 vUV;

uniform sampler2D textureSampler;
uniform sampler2D gbufferTexture;   // alpha channel contains 1 on geometry, 0 on the cleared background.
uniform sampler2D depthTexture;     // r channel contains linear view depth normalised to the clip range.
uniform vec2 resolution;
uniform vec2 texelSize;
uniform float time;
uniform float cameraNear;
uniform float cameraFar;
uniform vec3 cameraPosition;
uniform mat4 projection;
uniform mat4 inverseProjection;
uniform mat4 view;
uniform mat4 inverseView;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    vec3 color = texture(textureSampler, vUV).rgb;

    fragColor = vec4(color, 1.0);
}
