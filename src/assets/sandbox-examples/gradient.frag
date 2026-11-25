#version 300 es
precision highp float;

// Gradients: mix() blends two colours, smoothstep() shapes the transition.

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

void main(void)
{
    vec3 deepBlue = vec3(0.05, 0.08, 0.22);
    vec3 hotPink = vec3(0.95, 0.25, 0.55);

    // A diagonal ramp: dot() projects the UV onto a direction.
    float ramp = dot(vUv, normalize(vec2(1.0, 1.0)));
    vec3 color = mix(deepBlue, hotPink, smoothstep(0.1, 0.9, ramp));

    // A soft travelling band on top.
    float band = smoothstep(0.08, 0.0, abs(vUv.y - 0.5 - 0.25 * sin(uTime * 1.2)));
    color += band * vec3(0.3, 0.5, 0.9);

    fragColor = vec4(color, 1.0);
}
