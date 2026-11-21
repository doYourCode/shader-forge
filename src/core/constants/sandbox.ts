import sandboxVertexShader from '@/assets/internal-shaders/sandbox.vert.glsl?raw';
import sandboxFragmentShader from '@/assets/internal-shaders/sandbox.frag.glsl?raw';

/**
 * The 2D sandbox deliberately uses a smaller ABI than the 3D material: a
 * fullscreen triangle and a fragment document with `vUv`, `uResolution` and
 * `uTime`. Keeping the vertex stage internal means the sandbox can never
 * produce a mismatched vertex/fragment pair.
 */
export const sandboxVertexSource = sandboxVertexShader;
export const defaultSandboxFragmentShader = sandboxFragmentShader;
