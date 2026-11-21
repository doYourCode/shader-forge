#version 300 es
precision highp float;

// Fullscreen triangle generated without vertex buffers. The varying is the
// normalized screen coordinate, so the fragment stage can stay resolution
// independent.
out vec2 vUv;

void main(void)
{
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    vUv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
