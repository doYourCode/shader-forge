#version 300 es
precision highp float;

layout(location = 0) out vec4 fragColor;

void main()
{
    // Acquire screen space coordinates
    vec2 screenCoords = gl_FragCoord.xy;

    // Get the screen-space diagonal warning stripes mask.
    float stripePattern = mod(screenCoords.x + screenCoords.y, 100.0);
    float stripeWidth = 40.0;
    float stripe = step(stripeWidth, stripePattern);

    vec3 yellow = vec3(0.9, 0.9, 0.2);
    vec3 red = vec3(0.9, 0.2, 0.2);

    vec3 baseColor = mix(red, yellow, stripe);

    fragColor = vec4(baseColor, 1.0);
}
