#version 300 es
precision highp float;

// Fullscreen triangle for the sandbox post-effect chain. The varying matches
// the 3D post-effect ABI (`vUV`), so effect documents are interchangeable.
out vec2 vUV;

void main(void)
{
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    vUV = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
