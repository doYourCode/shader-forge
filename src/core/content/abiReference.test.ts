/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  ABI_REFERENCE_PATH,
  buildAbiReferenceMarkdown,
} from './abiReference';
import {
  SHADER_ATTRIBUTE_SPECS,
  SHADER_SAMPLER_SPECS,
  SHADER_UNIFORM_SPECS,
} from '@/core/constants/materialAbi';
import {
  POST_EFFECT_SAMPLER_SPECS,
  POST_EFFECT_UNIFORM_SPECS,
} from '@/core/constants/postEffectAbi';
import { SANDBOX_ABI_SPECS } from '@/core/constants/sandboxAbi';
import {
  SCREEN_SPACE_SAMPLER_SPECS,
  SCREEN_SPACE_UNIFORM_SPECS,
} from '@/core/constants/screenSpaceAbi';

const committed = readFileSync(
  new URL(`../../../${ABI_REFERENCE_PATH}`, import.meta.url),
  'utf8',
);

describe('generated ABI reference', () => {
  it('matches the committed page exactly (no drift)', () => {
    expect(committed).toBe(buildAbiReferenceMarkdown());
  });

  it('lists every material ABI name with its type and hint', () => {
    for (const [name, spec] of Object.entries({
      ...SHADER_ATTRIBUTE_SPECS,
      ...SHADER_UNIFORM_SPECS,
      ...SHADER_SAMPLER_SPECS,
    })) {
      expect(committed).toContain(`\`${name}\``);
      expect(committed).toContain(`\`${spec.glslType}\``);
      expect(committed).toContain(spec.hint.replace(/\|/g, '\\|'));
    }
  });

  it('lists every post-effect name', () => {
    for (const [name, spec] of Object.entries({
      ...POST_EFFECT_UNIFORM_SPECS,
      ...POST_EFFECT_SAMPLER_SPECS,
    })) {
      expect(committed).toContain(`\`${name}\``);
      expect(committed).toContain(`\`${spec.glslType}\``);
    }
  });

  it('lists every screen-space and sandbox name', () => {
    for (const name of [
      ...Object.keys(SCREEN_SPACE_UNIFORM_SPECS),
      ...Object.keys(SCREEN_SPACE_SAMPLER_SPECS),
      ...Object.keys(SANDBOX_ABI_SPECS),
    ]) {
      expect(committed).toContain(`\`${name}\``);
    }
  });

  it('renders as a normal content page', () => {
    expect(committed.startsWith('---\n')).toBe(true);
    expect(committed).toContain('title: ABI Reference');
    expect(committed).toContain('section: reference');
    expect(committed).toContain('generated: true');
  });
});
