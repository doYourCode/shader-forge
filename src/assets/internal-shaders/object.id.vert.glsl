#version 300 es
precision highp float;

// Object id prepass. Each mesh is drawn with its own runtime shader so the
// object id can be a uniform; the id is written untouched to an R32F target.

in vec3 position;

uniform mat4 world;
uniform mat4 viewProjection;
uniform float objectId;

out float vObjectId;

void main(void)
{
    vObjectId = objectId;
    gl_Position = viewProjection * world * vec4(position, 1.0);
}
