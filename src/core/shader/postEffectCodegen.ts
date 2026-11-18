import type {
  PostEffectDocument,
  PostEffectSource,
} from '@/core/models/postEffect';
import {
  isSamplerKind,
  type UserDataDocument,
} from '@/core/models/userUniform';
import { assembleStage, generateBlock } from './uniformCodegen';

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
  const block = generateBlock(document, 'post');
  const assembly = assembleStage(effect.fragment, block);
  const targeted = document.definitions.filter(
    (definition) => definition.stages === 'post',
  );

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
