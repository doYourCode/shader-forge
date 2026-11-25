import { describe, expect, it } from 'vitest';

import { editorPath, isEditorTarget, parseEditorQuery } from './editorLinks';

describe('editorPath', () => {
  it('builds a bare route when there is no payload', () => {
    expect(editorPath({ target: 'editor' })).toBe('/editor');
    expect(editorPath({ target: 'sandbox' })).toBe('/sandbox');
    expect(editorPath({ target: 'screen-space' })).toBe('/screen-space');
  });

  it('encodes an inline shader so it survives the query string', () => {
    const code =
      '#version 300 es\nvoid main() { fragColor = vec4(1.0, 0.5, 0.0, 1.0); }';
    const url = editorPath({ target: 'sandbox', code });

    expect(url.startsWith('/sandbox?')).toBe(true);

    const query = parseEditorQuery(
      Object.fromEntries(new URLSearchParams(url.split('?')[1] ?? '')),
    );
    expect(query.code).toBe(code);
  });

  it('keeps example, effect and tab separate', () => {
    const url = editorPath({
      target: 'editor',
      example: 'phong',
      effect: 'vignette',
      tab: 'post',
    });

    const query = parseEditorQuery(
      Object.fromEntries(new URLSearchParams(url.split('?')[1] ?? '')),
    );

    expect(query).toEqual({
      example: 'phong',
      effect: 'vignette',
      code: null,
      tab: 'post',
    });
  });
});

describe('parseEditorQuery', () => {
  it('tolerates array values and nulls from the router', () => {
    expect(
      parseEditorQuery({
        example: ['phong', 'lambert'],
        effect: null,
        code: undefined,
      }),
    ).toEqual({ example: 'phong', effect: null, code: null, tab: null });
  });
});

describe('isEditorTarget', () => {
  it('accepts exactly the three routes', () => {
    for (const target of ['editor', 'sandbox', 'screen-space']) {
      expect(isEditorTarget(target)).toBe(true);
    }

    expect(isEditorTarget('post')).toBe(false);
    expect(isEditorTarget(null)).toBe(false);
  });
});
