/**
 * Builds the generated ABI reference page.
 *
 * The tables are derived from the same declarations the renderer binds, so a
 * name, type or hint can never appear in the docs without existing in the ABI
 * (or vice versa). `scripts/generate-abi-docs.mjs` writes the result to
 * `content/en/docs/abi-reference.md`; `abiReference.test.ts` fails when the
 * checked-in page drifts from this builder.
 *
 * Imports use explicit `.ts` extensions because the generator runs this module
 * directly under Node's type stripping, without a bundler.
 */

import {
  SHADER_ATTRIBUTE_SPECS,
  SHADER_SAMPLER_SPECS,
  SHADER_UNIFORM_SPECS,
} from '../constants/materialAbi.ts';
import {
  POST_EFFECT_SAMPLER_SPECS,
  POST_EFFECT_TONEMAP_UNIFORM,
  POST_EFFECT_UNIFORM_SPECS,
} from '../constants/postEffectAbi.ts';
import { SANDBOX_ABI_SPECS } from '../constants/sandboxAbi.ts';
import {
  SCREEN_SPACE_DISPLAY_SAMPLER_SPECS,
  SCREEN_SPACE_DISPLAY_UNIFORM_SPECS,
  SCREEN_SPACE_SAMPLER_SPECS,
  SCREEN_SPACE_UNIFORM_SPECS,
} from '../constants/screenSpaceAbi.ts';

/** Canonical content path of the generated page. */
export const ABI_REFERENCE_PATH = 'content/en/docs/abi-reference.md';

const GENERATED_NOTICE =
  '<!-- GENERATED FILE: run `npm run docs:abi` after changing an ABI declaration. Do not edit by hand. -->';

interface AbiSpec {
  readonly glslType: string;
  readonly hint: string;
}

interface SandboxSpec {
  readonly qualifier: string;
  readonly glslType: string;
  readonly hint: string;
}

/** Escapes a value for a Markdown table cell. */
function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function specTable(
  specs: Readonly<Record<string, AbiSpec>>,
  firstColumn = 'Name',
): string {
  const rows = Object.entries(specs).map(
    ([name, spec]) =>
      `| \`${cell(name)}\` | \`${cell(spec.glslType)}\` | ${cell(spec.hint)} |`,
  );

  return [
    `| ${firstColumn} | GLSL type | Description |`,
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function sandboxTable(
  specs: Readonly<Record<string, SandboxSpec>>,
): string {
  const rows = Object.entries(specs).map(
    ([name, spec]) =>
      `| \`${cell(name)}\` | \`${cell(spec.qualifier)} ${cell(spec.glslType)}\` | ${cell(spec.hint)} |`,
  );

  return [
    '| Name | Declaration | Description |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');
}

/**
 * The complete Markdown source of the ABI reference, frontmatter included.
 * Deterministic: no timestamps, so the drift test compares strings.
 */
export function buildAbiReferenceMarkdown(): string {
  return `---
title: ABI Reference
description: Every attribute, uniform and sampler the three editors bind, generated from materialAbi.ts, postEffectAbi.ts and screenSpaceAbi.ts.
section: api
order: 0
generated: true
draft: false
---

${GENERATED_NOTICE}

# ABI Reference

This page is the contract between your GLSL and the renderer. Every name below
is declared by the engine before your source is compiled, so declaring it again
in the editor produces a duplicate declaration. The tables are generated from
the same TypeScript declarations the binders use: if a name is not here, the
editor does not provide it.

| Editor | Route | ABI source |
| --- | --- | --- |
| 3D Shader Editor | \`/editor\` | \`src/core/constants/materialAbi.ts\` |
| 2D Sandbox | \`/sandbox\` | \`src/core/constants/sandboxAbi.ts\` |
| Post effects (3D and sandbox) | Post effect tab | \`src/core/constants/postEffectAbi.ts\` |
| Screen Space GLSL Editor | \`/screen-space\` | \`src/core/constants/screenSpaceAbi.ts\` |

## 3D Shader Editor: surface shader

### Vertex attributes

Attributes are vertex inputs, declared with \`in\`. They arrive from the mesh, not
from a uniform block.

${specTable(SHADER_ATTRIBUTE_SPECS)}

### Uniforms

${specTable(SHADER_UNIFORM_SPECS)}

### Samplers

${specTable(SHADER_SAMPLER_SPECS)}

## Post effects (3D Shader Editor and 2D Sandbox)

Each effect is a fullscreen fragment pass. \`textureSampler\` is the previous
pass's output; \`textureSampler\`, \`gbufferTexture\` and \`depthTexture\` are the
surface-scene variants. The screen-space editor has its own, richer G-buffer
listed below.

### Uniforms

${specTable(POST_EFFECT_UNIFORM_SPECS)}

### Samplers

${specTable(POST_EFFECT_SAMPLER_SPECS)}

The internal display pass additionally owns \`${POST_EFFECT_TONEMAP_UNIFORM}\`
and reserves \`vUV\`, \`fragColor\` and \`gl_FragColor\`. Do not redeclare them.

## Screen Space GLSL Editor

Screen-space effects run over the whole HDR scene. They can read the previous
pass, the untouched scene colour and every G-buffer attachment.

### Uniforms

${specTable(SCREEN_SPACE_UNIFORM_SPECS)}

### G-buffer samplers

${specTable(SCREEN_SPACE_SAMPLER_SPECS)}

### Display-only names

The internal display pass adds these names on top of the public ABI. They are
visible in the compiled display shader, never in your effect source, and are
reserved so user data cannot collide with them.

${specTable(SCREEN_SPACE_DISPLAY_UNIFORM_SPECS)}

${specTable(SCREEN_SPACE_DISPLAY_SAMPLER_SPECS)}

The display pass also reserves \`vUV\`, \`fragColor\` and \`gl_FragColor\`.

## 2D Sandbox

The sandbox has no editable vertex stage. An internal fullscreen triangle
provides \`vUv\`, and the engine provides the resolution and time uniforms.

${sandboxTable(SANDBOX_ABI_SPECS)}

The sandbox also reserves every post-effect name, because the same User data
table can target both the base fragment and the post-effect chain.

## Derived helper names

The default screen-space effect declares helper functions on top of the
samplers above. They are not engine uniforms, but they document the encoding
the G-buffer uses:

| Helper | Returns |
| --- | --- |
| \`gbufferAlbedo(uv)\` | Linear albedo (the attachment is sqrt-encoded). |
| \`gbufferRoughness(uv)\` | \`1.0 - materialTexture.a\`. |
| \`gbufferMetallic(uv)\` | Metallic reconstructed from F0 and albedo. |
| \`gbufferViewPosition(uv)\` | View-space position reconstructed from depth and the inverse projection. |

## Related

- [Screen Space GLSL Editor](/docs/screen-space-editor)
- [Post effects](/docs/post-effects)
- [User data](/docs/user-data)
- [GLSL ES 3.00](/knowledge/gles-3-0-webgl2)
- [Debugging shaders](/knowledge/debugging-shaders)
- [Cheat sheet](/docs/cheat-sheet)

## Regenerating this page

\`\`\`bash
npm run docs:abi
\`\`\`

\`predev\`, \`prebuild\` and \`pretest\` run the same command, so the page is rebuilt
before the app, the production bundle and the test suite. The drift test
\`src/core/content/abiReference.test.ts\` compares the committed file with this
builder and fails if they diverge.
`;
}
