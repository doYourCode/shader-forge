#version 300 es
precision highp float;

// Noise: a hash is the cheapest source of pseudo-random values in GLSL.
// This is value noise; fbm() layers several octaves of it.

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p)
{
    vec2 cell = floor(p);
    vec2 local = fract(p);
    vec2 smoothWeights = local * local * (3.0 - 2.0 * local);

    float bottomLeft = hash(cell);
    float bottomRight = hash(cell + vec2(1.0, 0.0));
    float topLeft = hash(cell + vec2(0.0, 1.0));
    float topRight = hash(cell + vec2(1.0, 1.0));

    return mix(
        mix(bottomLeft, bottomRight, smoothWeights.x),
        mix(topLeft, topRight, smoothWeights.x),
        smoothWeights.y
    );
}

float fbm(vec2 p)
{
    float sum = 0.0;
    float amplitude = 0.5;

    for (int octave = 0; octave < 5; octave++)
    {
        sum += amplitude * valueNoise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }

    return sum;
}

void main(void)
{
    vec2 uv = vUv;
    uv.x *= uResolution.x / uResolution.y;

    float n = fbm(uv * 5.0 + vec2(uTime * 0.15, 0.0));
    vec3 color = mix(vec3(0.03, 0.05, 0.12), vec3(0.95, 0.70, 0.35), n);

    // A second band makes the structure easier to read.
    color += 0.15 * vec3(n, n * n, n * n * n);

    fragColor = vec4(color, 1.0);
}
