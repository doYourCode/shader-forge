#version 300 es
precision highp float;

// Signed distance fields: a function returns the distance to a shape.
// Negative is inside, positive is outside; smoothstep() antialiases the edge.

in vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

out vec4 fragColor;

float sdCircle(vec2 p, float radius)
{
    return length(p) - radius;
}

float sdBox(vec2 p, vec2 halfSize)
{
    vec2 d = abs(p) - halfSize;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main(void)
{
    vec2 p = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    // Rotate the box a little so its shape reads against the circle.
    float angle = 0.35 + 0.15 * sin(uTime);
    mat2 rotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));

    float circle = sdCircle(p - vec2(-0.18, 0.0), 0.24);
    float box = sdBox(rotation * (p - vec2(0.18, 0.0)), vec2(0.20));

    // Union: the smaller distance is the closer surface.
    float shape = min(circle, box);

    // Stroke: a narrow band around distance zero.
    float stroke = smoothstep(0.012, 0.0, abs(shape));
    float fill = smoothstep(0.0, 0.01, -shape);

    vec3 color = vec3(0.04, 0.05, 0.09);
    color = mix(color, vec3(0.20, 0.35, 0.65), fill);
    color = mix(color, vec3(0.95, 0.85, 0.55), stroke);

    fragColor = vec4(color, 1.0);
}
