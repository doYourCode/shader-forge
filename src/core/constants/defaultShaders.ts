import defaultVertex from '@/assets/internal-shaders/default.vert.glsl?raw';
import defaultFragment from '@/assets/internal-shaders/default.frag.glsl?raw';

import {
  SHADER_ATTRIBUTE_SPECS,
  SHADER_SAMPLER_SPECS,
  SHADER_UNIFORM_SPECS,
} from './materialAbi';

/**
 * Default shaders shown in the editor on first load.
 * Sourced directly from the .glsl asset files so the editor defaults
 * can never drift from the shaders Babylon validates against.
 */
export const defaultVertexShader = defaultVertex;
export const defaultFragmentShader = defaultFragment;

/** Column the trailing comment starts at, so the reference stays scannable. */
const COMMENT_COLUMN = 44;

function declaration(
  qualifier: 'uniform' | 'in',
  glslType: string,
  name: string,
  hint: string,
): string {
  return `${`${qualifier} ${glslType} ${name}`.padEnd(COMMENT_COLUMN)}// ${hint}`;
}

/** One reference line per family member, in ABI declaration order. */
function referenceLines(
  qualifier: 'uniform' | 'in',
  specs: Readonly<
    Record<string, { readonly glslType: string; readonly hint: string }>
  >,
): string[] {
  return Object.entries(specs).map(([name, spec]) =>
    declaration(qualifier, spec.glslType, name, spec.hint),
  );
}

/**
 * Built-in `Uniforms` reference, generated from the material ABI.
 *
 * Generating it is the point: the tab used to advertise uniforms the material
 * never registered (`worldViewProjection`, `worldView`), so a user following
 * the reference compiled against uniforms that were never bound.
 */
export const defaultUniformsDoc = [
  '// Uniform input (from the engine)',
  '',
  ...referenceLines('uniform', SHADER_UNIFORM_SPECS),
  '',
  ...referenceLines('uniform', SHADER_SAMPLER_SPECS),
].join('\n');

/**
 * Built-in `Attributes` reference, generated from the material ABI. Attributes
 * are vertex inputs, so they are declared with `in` (they were previously
 * documented as `uniform`, which does not compile).
 */
export const defaultIoDoc = [
  '// Vertex attribute (from mesh data)',
  '',
  ...referenceLines('in', SHADER_ATTRIBUTE_SPECS),
].join('\n');
