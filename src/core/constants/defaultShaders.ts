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

uniform mat4 worldViewProjection    // Final clip-space transform;
uniform mat4 normalMatrix           // Inverse-transpose world matrix;
uniform mat4 world                  // Mesh world matrix;
uniform mat4 worldView              // World * view;
uniform mat4 view                   // Camera view matrix;
uniform mat4 projection             // Camera projection matrix;

uniform vec3 cameraPos;             // Position of the camera in world-space;
uniform vec3 lightDir;              // Direction vector of the light in world-space.
uniform float time;                 // Used for animating effects based on a timescale;

uniform samplerCube irradianceMap;              // Diffuse irradiance (cosine-convolved environment cubemap);
uniform samplerCube prefilteredEnvironmentMap;  // GGX-prefiltered specular cubemap (higher mip levels = rougher);
uniform sampler2D brdfLUT;                      // Split-sum LUT (R = bias, G = albedo); sample at (NdotV, roughness), then mix(R, G, F0).
`.trim();

export const defaultIoDoc = `
// Vertex attribute (from mesh data)

uniform vec3 position   // Vertex position in object/local space;
uniform vec3 normal     // Surface normal direction;
uniform vec3 tangent    // Tangent direction for normal mapping;
uniform vec2 uv         // Primary texture coordinates;
uniform vec2 uv2        // Secondary texture coordinates;
uniform vec3 color      // Vertex color (RGB).

`.trim();
