#version 300 es
precision highp float;

in vec3 vViewNormal;

// rgb: view-space normal encoded into [0, 1]
// a:   reserved (1 where geometry was drawn, 0 on cleared background)
layout(location = 0) out vec4 fragColor;

void main(void)
{
    fragColor = vec4(normalize(vViewNormal) * 0.5 + 0.5, 1.0);
}
