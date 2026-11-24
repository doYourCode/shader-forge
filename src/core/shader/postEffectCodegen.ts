import type {
  PostEffectDocument,
  PostEffectSource,
} from '@/core/models/postEffect';
import {
  isSamplerKind,
  type UserDataDocument,
  type UserUniformDefinition,
} from '@/core/models/userUniform';
import {
  assembleStage,
  generateBlock,
  generateSandboxPostBlock,
} from './uniformCodegen';

/**
 * Projects a post-effect document onto the fragment handed to the driver:
 * the user's text with the generated `post` user-data block injected, plus
 * the declarations that block introduces.
 *
 * Surface and post documents share one user-data table, so a definition only
 * reaches an effect when it targets the `post` stage.
 */
export function buildPostEffectSource(
  document: UserDataDocument,
  effect: PostEffectDocument,
): PostEffectSource {
  return buildPostEffectSourceFrom(
    effect,
    generateBlock(document, 'post'),
    document.definitions.filter((definition) => definition.stages === 'post'),
  );
}

/**
 * Sandbox variant: there is no vertex stage, so `both` means "base fragment and
 * post effects" and must also be injected and bound in every post pass.
 */
export function buildSandboxPostEffectSource(
  document: UserDataDocument,
  effect: PostEffectDocument,
): PostEffectSource {
  return buildPostEffectSourceFrom(
    effect,
    generateSandboxPostBlock(document),
    document.definitions.filter(
      (definition) =>
        definition.stages === 'post' || definition.stages === 'both',
    ),
  );
}

function buildPostEffectSourceFrom(
  effect: PostEffectDocument,
  block: ReturnType<typeof generateBlock>,
  targeted: readonly UserUniformDefinition[],
): PostEffectSource {
  const assembly = assembleStage(effect.fragment, block);

  return {
    id: effect.id,
    name: effect.name,
    fragment: assembly.source,
    editorSource: effect.fragment,
    extraUniforms: targeted
      .filter((definition) => !isSamplerKind(definition.kind))
      .map((definition) => definition.name),
    extraSamplers: targeted
      .filter((definition) => isSamplerKind(definition.kind))
      .map((definition) => definition.name),
    injected: assembly.injected,
    declarationRowByLine: assembly.declarationRowByLine,
  };
}
