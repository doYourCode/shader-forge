varying vec3 vNormal;
varying vec3 vPosition;

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

    gl_FragColor = vec4(baseColor, 1.0);
}