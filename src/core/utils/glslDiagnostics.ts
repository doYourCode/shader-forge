import type { ShaderErrorKind } from '@/core/models/shaderError';

export type GlslVersion = '100' | '300 es';

export interface GlslDiagnosticContext {
  glslVersion: GlslVersion;
}

export interface GlslIssueDescription {
  kind: ShaderErrorKind;
  /** Short plain-English title shown above the raw driver message. */
  title: string;
  /** Actionable advice, or null when there is no useful specific hint. */
  advice: string | null;
}

type Describer = (
  message: string,
  version: GlslVersion,
) => GlslIssueDescription;

interface DiagnosticRule {
  readonly pattern: RegExp;
  readonly describe: Describer;
  /** Restricts the rule to one source language version. */
  readonly glslVersion?: GlslVersion;
}

function genericAdvice(version: GlslVersion): string {
  if (version === '300 es') {
    return 'Compare this line with the GLSL ES 3.00 syntax reference. Use in/out instead of attribute/varying, texture() instead of texture2D(), and declare the fragment output as layout(location = 0) out vec4 fragColor;. Common causes are typos, missing semicolons, or mismatched types.';
  }

  return 'Compare this line with the GLSL ES 1.00 syntax reference. Common causes are typos, missing semicolons, or mismatched types.';
}

const DEFAULT_DESCRIPTION: Describer = (_message, version) => ({
  kind: 'program',
  title: 'Shader compiler error',
  advice: genericAdvice(version),
});

/**
 * Ordered rules that translate cryptic driver messages into plain English.
 * The first matching rule wins, so put the most specific patterns first.
 * Rules marked with `glslVersion` only apply when the user's source declares
 * that version; the others keep their original behaviour.
 */
const RULES: readonly DiagnosticRule[] = [
  {
    pattern:
      /#version[^\n]*(?:\bfirst\b|\bbeginning\b|\bbefore\b|\bpreced(?:e|ing)\b|\bmust\b)/i,
    describe: () => ({
      kind: 'syntax',
      title: '#version must be on the first line',
      advice:
        'Move the #version directive to the very first line of the shader, before any comments, precision statements, or declarations.',
    }),
  },
  {
    pattern: /gl_FragColor|gl_FragData/i,
    glslVersion: '300 es',
    describe: (message) => {
      const token = /gl_FragData/i.test(message)
        ? 'gl_FragData'
        : 'gl_FragColor';

      return {
        kind: 'syntax',
        title: `${token} is not available in GLSL ES 3.00`,
        advice: `Declare a fragment output with layout(location = 0) out vec4 fragColor; and assign the final colour to it instead of ${token}.`,
      };
    },
  },
  {
    pattern:
      /['"`]\s*(?:attribute|varying)\s*['"`]|\b(?:attribute|varying)\b[^\n]*(?:syntax error|reserved|not (?:available|supported)|undeclared)/i,
    glslVersion: '300 es',
    describe: (message) => {
      const keyword = /\battribute\b/i.test(message)
        ? 'attribute'
        : 'varying';

      return {
        kind: 'syntax',
        title: `'${keyword}' is not available in GLSL ES 3.00`,
        advice:
          keyword === 'attribute'
            ? 'Replace attribute with in for vertex inputs. Vertex outputs and fragment inputs both use in/out declarations.'
            : 'Replace varying with out in the vertex shader and in in the fragment shader.',
      };
    },
  },
  {
    pattern:
      /(?:fragment|frag)\b[^\n]*\b(?:no|missing|not|without|must|requires?|does\s+not|doesn't)\b[^\n]*(?:output|write|declar)|(?:missing|no)\s+(?:fragment\s+)?output|output[^\n]*\b(?:not|missing|never)\b[^\n]*declar/i,
    glslVersion: '300 es',
    describe: () => ({
      kind: 'syntax',
      title: 'Missing fragment output',
      advice:
        'Declare the fragment colour output with layout(location = 0) out vec4 fragColor; and write to it inside main().',
    }),
  },
  {
    pattern: /unexpected (?:token|character|identifier|'\S+'|"\S+")/i,
    describe: (message) => {
      const token = quotedName(message);
      return {
        kind: 'syntax',
        title: token ? `Unexpected token '${token}'` : 'Unexpected token',
        advice:
          'Something appeared where the compiler did not expect it. Look for a stray character, a missing semicolon on the previous line, or an unclosed ( or { bracket.',
      };
    },
  },
  {
    pattern:
      /\bexpected\b.*(?:';'|'\)'|'\('|'}'|'\{'|\[\]|end of file|expression|identifier)/i,
    describe: (message) => ({
      kind: 'syntax',
      title: `Missing ${describeExpectedToken(message)}`,
      advice:
        'A required token is missing. Check the highlighted line for an unfinished statement, an unclosed bracket, or a missing semicolon.',
    }),
  },
  {
    pattern: /syntax error|parse error|invalid syntax|illegal character/i,
    describe: (message) => ({
      kind: 'syntax',
      title: 'Syntax error',
      advice: message.toLowerCase().includes('illegal character')
        ? 'The shader contains a character that GLSL does not allow. Remove or replace the highlighted character.'
        : 'The compiler could not parse this line. Check for a typo or an unclosed bracket, and check the line above for a missing semicolon.',
    }),
  },
  {
    pattern: /unterminated|premature end of file|end of file/i,
    describe: () => ({
      kind: 'syntax',
      title: 'Unfinished block',
      advice:
        'A comment, bracket, or block is never closed. Look for a missing */, }, or ) near this line.',
    }),
  },
  {
    pattern:
      /undeclared|not declared|unknown identifier|invalid identifier|undefined identifier/i,
    describe: (message) => {
      const name = quotedName(message);
      return {
        kind: 'logic',
        title: name ? `Unknown identifier '${name}'` : 'Unknown identifier',
        advice: name
          ? `'${name}' is used before it is declared. Check the spelling, or declare it as a local variable, uniform, attribute, or varying before this line.`
          : 'A name is used before it is declared. Check the spelling and the declaration order.',
      };
    },
  },
  {
    pattern:
      /redefinition|redeclaration|already defined|already declared|already has a body|duplicate definition/i,
    describe: (message) => {
      const name = quotedName(message);
      return {
        kind: 'logic',
        title: name ? `'${name}' is declared twice` : 'Duplicate declaration',
        advice:
          'This name is already declared in the same scope. Rename one of the declarations or remove the duplicate.',
      };
    },
  },
  {
    pattern: /no matching (?:overloaded )?function|no matching overload|overload resolution/i,
    describe: (message, version) => {
      const name = quotedName(message);
      return {
        kind: 'logic',
        title: name ? `No matching function for '${name}'` : 'No matching function',
        advice:
          version === '300 es'
            ? 'This function exists, but not with these argument types. Check the number and types of the arguments. GLSL ES 3.00 uses texture(sampler, vec2) instead of texture2D(), and in/out instead of attribute/varying.'
            : 'This function exists, but not with these argument types. Check the number and types of the arguments. GLSL ES 1.00 uses texture2D(sampler, vec2), not texture().',
      };
    },
  },
  {
    pattern:
      /cannot convert|type mismatch|incompatible type|wrong operand types?|cannot assign|no implicit conversion/i,
    describe: () => ({
      kind: 'type',
      title: 'Type mismatch',
      advice:
        'The value does not match the expected type. Use an explicit constructor such as vec3(...), vec4(...), or float(...) to convert it.',
    }),
  },
  {
    pattern: /precision/i,
    describe: (_message, version) => ({
      kind: 'syntax',
      title: 'Missing precision qualifier',
      advice:
        version === '300 es'
          ? 'Add a default precision after the #version 300 es line, for example: precision highp float;'
          : 'Add a default precision at the top of the shader, for example: precision highp float;',
    }),
  },
  {
    pattern: /'main'|missing main|main.*not found|main.*undefined/i,
    describe: () => ({
      kind: 'logic',
      title: 'Missing entry point',
      advice:
        'Every shader must define void main() { ... }. Check the spelling and the parameter list of main.',
    }),
  },
  {
    pattern: /link|mismatch.*vary|vary.*mismatch|interface block|input.*output/i,
    describe: () => ({
      kind: 'link',
      title: 'Shaders do not match',
      advice:
        'The vertex output and fragment input do not line up. Give each varying the same name and type in both shaders.',
    }),
  },
  {
    pattern: /unsupported|not supported|version|extension/i,
    describe: (_message, version) => ({
      kind: 'program',
      title: 'Unsupported GLSL feature',
      advice:
        version === '300 es'
          ? 'That feature is not available in the GLSL version used by this renderer. Enable the matching #extension or rewrite the statement using GLSL ES 3.00 features such as in/out, texture(), and layout(location = 0) out.'
          : 'That feature is not available in the GLSL version used by this renderer. Enable the matching #extension or rewrite the statement using GLSL ES 1.00 features.',
    }),
  },
  {
    pattern: /reserved|keyword/i,
    describe: (message) => {
      const name = quotedName(message);
      return {
        kind: 'logic',
        title: name ? `'${name}' is a reserved word` : 'Reserved word',
        advice: 'GLSL reserves this word. Choose a different name for the variable or function.',
      };
    },
  },
  {
    pattern: /too many|exceeds?.*limit|out of (?:memory|resources)|too complex/i,
    describe: () => ({
      kind: 'program',
      title: 'Shader is too complex',
      advice:
        'The driver hit a shader limit. Reduce loop iteration counts, uniform/varying counts, or the number of function calls.',
    }),
  },
];

/**
 * Maps a raw driver message to a friendly title, category, and suggestion.
 * The raw message is always preserved separately so advanced users can still
 * see exactly what the driver reported.
 *
 * `context` defaults to GLSL ES 1.00 so callers that do not know the source
 * version keep the original advice.
 */
export function describeGlslIssue(
  message: string,
  context?: GlslDiagnosticContext,
): GlslIssueDescription {
  const version = context?.glslVersion ?? '100';

  for (const rule of RULES) {
    if (rule.glslVersion && rule.glslVersion !== version) continue;
    if (rule.pattern.test(message)) {
      return rule.describe(message, version);
    }
  }

  return DEFAULT_DESCRIPTION(message, version);
}

function quotedName(message: string): string | null {
  const match =
    /'([^']+)'/.exec(message) ??
    /"([^"]+)"/.exec(message) ??
    /`([^`']+)'/.exec(message);
  const name = match?.[1]?.trim();
  return name ? name : null;
}

function describeExpectedToken(message: string): string {
  const match = /expected\s+('[^']+'|"..."|end of file)/i.exec(message);
  return match ? match[1] : 'token';
}
