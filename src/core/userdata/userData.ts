import { GLSL_RESERVED_WORDS } from '@/core/constants/glslReservedWords';
import {
  SHADER_ATTRIBUTES,
  SHADER_SAMPLER_NAMES,
  SHADER_SAMPLERS,
  SHADER_UNIFORM_NAMES,
  SHADER_UNIFORMS,
} from '@/core/constants/materialAbi';
import { POST_EFFECT_RESERVED_NAMES } from '@/core/constants/postEffectAbi';
import type {
  MaterialBlueprint,
  ShaderSource,
} from '@/core/models/shaderSource';
import {
  isSamplerKind,
  validateUniformName,
  type NameValidationResult,
  type UserDataDocument,
} from '@/core/models/userUniform';
import {
  assembleStage,
  assembleUserData,
  generateSandboxFragmentBlock,
  toStageAssemblyRecord,
} from '@/core/shader/uniformCodegen';

/**
 * Names the engine already owns. Imported (never copied) from the material ABI
 * so the shader contract and the validation cannot drift apart.
 */
export const BUILTIN_RESERVED_UNIFORM_NAMES: ReadonlySet<string> = new Set([
  ...Object.values(SHADER_UNIFORM_NAMES),
  ...Object.values(SHADER_SAMPLER_NAMES),
  ...SHADER_UNIFORMS,
  ...SHADER_SAMPLERS,
  ...SHADER_ATTRIBUTES,
  ...POST_EFFECT_RESERVED_NAMES,
]);

/** Everything a user uniform may not be named, in one place. */
export const RESERVED_UNIFORM_NAMES: ReadonlySet<string> = new Set([
  ...GLSL_RESERVED_WORDS,
  ...BUILTIN_RESERVED_UNIFORM_NAMES,
]);

/**
 * Validates a candidate uniform name against the document's other definitions.
 * The definition being renamed is excluded so it can keep its own name.
 */
export function validateUserDataName(
  document: UserDataDocument,
  name: string,
  exceptId?: string,
  reservedNames: ReadonlySet<string> = RESERVED_UNIFORM_NAMES,
): NameValidationResult {
  const taken = new Set<string>();
  for (const definition of document.definitions) {
    if (definition.id !== exceptId) taken.add(definition.name);
  }

  return validateUniformName(name, taken, reservedNames);
}

/**
 * Projects the document onto assembled GLSL plus the material extras.
 *
 * Kept free of GPU and debounce concerns so the codegen contract can be tested
 * without a controller, registry or binder.
 */
export function buildUserDataBlueprint(
  document: UserDataDocument,
  sources: ShaderSource,
): MaterialBlueprint {
  const assembly = assembleUserData(document, sources.vertex, sources.fragment);

  return {
    vertex: assembly.vertex,
    fragment: assembly.fragment,
    // Keep the authoring pair on the blueprint: the assembled stages above
    // contain generated lines the editor never shows, and diagnostics must
    // be translated back to this exact text.
    editorSource: {
      vertex: sources.vertex,
      fragment: sources.fragment,
    },
    ...userDataExtras(document),
    userData: assembly.record,
  };
}

/**
 * Projects the document onto the sandbox's base fragment document.
 *
 * `fragment` and `both` definitions belong here; `post` definitions are
 * assembled into every post-effect pass instead. The internal vertex source
 * travels unchanged so the generic diagnostic contract still has a source pair
 * to map.
 */
export function buildSandboxBlueprint(
  document: UserDataDocument,
  sources: ShaderSource,
): MaterialBlueprint {
  const fragment = assembleStage(
    sources.fragment,
    generateSandboxFragmentBlock(document),
  );

  return {
    vertex: sources.vertex,
    fragment: fragment.source,
    editorSource: {
      vertex: sources.vertex,
      fragment: sources.fragment,
    },
    ...userDataExtras(document),
    userData: {
      vertex: null,
      fragment: toStageAssemblyRecord(fragment),
    },
  };
}

function userDataExtras(document: UserDataDocument) {
  return {
    extraUniforms: document.definitions
      .filter((definition) => !isSamplerKind(definition.kind))
      .map((definition) => definition.name),
    extraSamplers: document.definitions
      .filter((definition) => isSamplerKind(definition.kind))
      .map((definition) => definition.name),
  };
}
