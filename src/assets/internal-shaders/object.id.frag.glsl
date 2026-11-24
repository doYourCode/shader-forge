#version 300 es
precision highp float;

in float vObjectId;

layout(location = 0) out vec4 fragColor;

void main(void)
{
    fragColor = vec4(vObjectId, 0.0, 0.0, 1.0);
}
