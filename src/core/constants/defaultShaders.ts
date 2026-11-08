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
// Uniform input (from the engine)

mat4 worldViewProjection    // Final clip-space transform;
mat4 normalMatrix           // Inverse-transpose world matrix;
mat4 world                  // Mesh world matrix;
mat4 worldView              // World * view;
mat4 view                   // Camera view matrix;
mat4 projection             // Camera projection matrix;

vec3 cameraPos;             // Position of the camera in world-space;
vec3 lightDir;              // Direction vector of the light in world-space.
float time                  // Used for animating effects based on a timescale;

samplerCube environmentMap; // The environment map (used for IBL)
`.trim();

export const defaultIoDoc = `
// Vertex attribute (from mesh data)

vec3 position   // Vertex position in object/local space;
vec3 normal     // Surface normal direction;
vec3 tangent    // Tangent direction for normal mapping;
vec2 uv         // Primary texture coordinates;
vec2 uv2        // Secondary texture coordinates;
vec3 color      // Vertex color (RGB).

`.trim();
