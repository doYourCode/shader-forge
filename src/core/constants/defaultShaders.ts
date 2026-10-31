import defaultVertex from '@/assets/internal-shaders/default.vert.glsl?raw';
import defaultFragment from '@/assets/internal-shaders/default.frag.glsl?raw';

/**
 * Default shaders shown in the editor on first load.
 * Sourced directly from the .glsl asset files so the editor defaults
 * can never drift from the shaders Babylon validates against.
 */
export const defaultVertexShader = defaultVertex;
export const defaultFragmentShader = defaultFragment;

export const defaultUniformsDoc = `
// Read-only reference for Babylon ShaderMaterial uniforms (GLSL ES 3.00).

worldViewProjection : mat4  // vertex: final clip-space transform
normalMatrix        : mat4  // vertex: inverse-transpose world matrix
world               : mat4  // mesh world matrix
worldView           : mat4  // world * view
view                : mat4  // camera view matrix
projection          : mat4  // camera projection matrix
time                : float // optional, set by host if needed
`.trim();

export const defaultIoDoc = `
// Read-only reference for GLSL ES 3.00 shader inputs and outputs.

// Vertex inputs (in)
position : vec3
normal   : vec3
uv       : vec2

// Vertex outputs (out) / fragment inputs (in)
vNormal  : vec3

// Fragment output (out)
fragColor : vec4  // layout(location = 0) out vec4 fragColor;
`.trim();