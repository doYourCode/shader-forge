import { describe, expect, it } from 'vitest';

import { describeGlslIssue } from './glslDiagnostics';

const ES_300 = { glslVersion: '300 es' } as const;
const ES_100 = { glslVersion: '100' } as const;

describe('describeGlslIssue', () => {
  it('defaults to GLSL ES 1.00 advice', () => {
    expect(describeGlslIssue('something the rules do not know')).toEqual(
      describeGlslIssue('something the rules do not know', ES_100),
    );
  });

  it('uses GLSL ES 3.00 terms for generic advice', () => {
    const advice = describeGlslIssue('something the rules do not know', ES_300)
      .advice;

    expect(advice).toContain('GLSL ES 3.00');
    expect(advice).toContain('in/out');
    expect(advice).toContain('texture()');
    expect(advice).toContain('layout(location = 0) out');
  });

  it('suggests texture() instead of texture2D() for ES 3.00', () => {
    const message = "no matching function for call to 'texture2D(vec4, vec2)'";

    expect(describeGlslIssue(message, ES_100).advice).toContain(
      'texture2D(sampler, vec2)',
    );
    expect(describeGlslIssue(message, ES_300).advice).toContain(
      'texture(sampler, vec2)',
    );
  });

  it('names the right GLSL version for unsupported features', () => {
    expect(describeGlslIssue('unsupported feature', ES_100).advice).toContain(
      'GLSL ES 1.00',
    );

    const advice = describeGlslIssue('unsupported feature', ES_300).advice;
    expect(advice).toContain('GLSL ES 3.00');
    expect(advice).toContain('in/out');
    expect(advice).toContain('layout(location = 0) out');
  });

  it('places the precision qualifier after #version in ES 3.00', () => {
    expect(
      describeGlslIssue('No precision specified for (float)', ES_100).advice,
    ).toContain('at the top of the shader');

    expect(
      describeGlslIssue('No precision specified for (float)', ES_300).advice,
    ).toContain('after the #version 300 es line');
  });

  it('explains gl_FragColor inside an ES 3.00 source', () => {
    const message = "ERROR: 0:6: 'gl_FragColor' : undeclared identifier";
    const issue = describeGlslIssue(message, ES_300);

    expect(issue.title).toContain('gl_FragColor');
    expect(issue.advice).toContain('layout(location = 0) out vec4 fragColor;');
    expect(issue.advice).toContain('instead of gl_FragColor');
  });

  it('keeps the 1.00 undeclared-identifier behaviour outside ES 3.00', () => {
    const issue = describeGlslIssue(
      "ERROR: 0:6: 'gl_FragColor' : undeclared identifier",
      ES_100,
    );

    expect(issue.kind).toBe('logic');
    expect(issue.title).toBe("Unknown identifier 'gl_FragColor'");
  });

  it('explains attribute and varying inside an ES 3.00 source', () => {
    const attribute = describeGlslIssue(
      "ERROR: 0:3: 'attribute' : syntax error",
      ES_300,
    );
    expect(attribute.title).toContain('attribute');
    expect(attribute.advice).toContain('Replace attribute with in');

    const varying = describeGlslIssue(
      "ERROR: 0:5: 'varying' : syntax error",
      ES_300,
    );
    expect(varying.title).toContain('varying');
    expect(varying.advice).toContain('out in the vertex shader');
  });

  it('matches ANGLE reserved-word messages for attribute and varying', () => {
    const attribute = describeGlslIssue(
      "ERROR: 0:4: 'attribute' : Illegal use of reserved word",
      ES_300,
    );
    expect(attribute.title).toContain('attribute');
    expect(attribute.advice).toContain('Replace attribute with in');

    const varying = describeGlslIssue(
      "ERROR: 0:5: 'varying' : Illegal use of reserved word",
      ES_300,
    );
    expect(varying.title).toContain('varying');
    expect(varying.advice).toContain('out in the vertex shader');
  });

  it('does not apply the ES 3.00 keyword rules to 1.00 sources', () => {
    expect(
      describeGlslIssue("ERROR: 0:3: 'attribute' : syntax error", ES_100).title,
    ).toBe('Syntax error');
  });

  it('explains a missing fragment output in ES 3.00', () => {
    const issue = describeGlslIssue(
      'The fragment shader does not write to any output.',
      ES_300,
    );

    expect(issue.title).toBe('Missing fragment output');
    expect(issue.advice).toContain('layout(location = 0) out vec4 fragColor;');
  });

  it('explains a misplaced #version directive for both versions', () => {
    const message =
      "ERROR: 0:3: '#version' : #version directive must occur before any other statement";

    expect(describeGlslIssue(message).title).toBe(
      '#version must be on the first line',
    );
    expect(describeGlslIssue(message, ES_300).title).toBe(
      '#version must be on the first line',
    );
  });

  it('keeps the first matching rule (gl_FragColor before undeclared)', () => {
    const issue = describeGlslIssue(
      "'gl_FragColor' : undeclared identifier",
      ES_300,
    );

    expect(issue.title).not.toContain('Unknown identifier');
  });
});
