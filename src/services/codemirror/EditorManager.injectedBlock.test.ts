// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import { EditorManager } from './EditorManager';

const DOC = `#version 300 es
precision highp float;

in vec3 position;

void main() {}`;

let active: EditorManager | null = null;

afterEach(() => {
  active?.dispose();
  active = null;
  document.body.innerHTML = '';
});

function mountEditor(doc = DOC): { manager: EditorManager; host: HTMLElement } {
  const host = document.createElement('div');
  document.body.append(host);

  const manager = new EditorManager();
  manager.mount(host, doc, () => {}, false);
  active = manager;

  return { manager, host };
}

function contentOf(host: HTMLElement): HTMLElement {
  const content = host.querySelector<HTMLElement>('.cm-content');
  if (!content) throw new Error('editor content missing');
  return content;
}

describe('EditorManager injected block', () => {
  it('previews the block without touching the document', () => {
    const { manager, host } = mountEditor();

    manager.setInjectedBlock(['uniform vec3 tint; // color (RGB)']);

    const block = host.querySelector('.cm-injected-block');
    expect(block).not.toBeNull();
    expect(block?.textContent).toContain('uniform vec3 tint; // color (RGB)');
    expect(block?.textContent).toContain('read-only');
    expect(manager.getValue()).toBe(DOC);
  });

  it('places the preview after the header and before the declarations', () => {
    const { manager, host } = mountEditor();

    manager.setInjectedBlock(['uniform vec3 tint; // color (RGB)']);

    const content = contentOf(host);
    const block = content.querySelector('.cm-injected-block');
    const attributeLine = [...content.querySelectorAll('.cm-line')].find(
      (line) => line.textContent?.includes('in vec3 position;'),
    );

    expect(block).not.toBeNull();
    expect(attributeLine).toBeDefined();
    expect(
      block!.compareDocumentPosition(attributeLine!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('updates and clears the preview through the effect', () => {
    const { manager, host } = mountEditor();

    manager.setInjectedBlock(['uniform float a;']);
    manager.setInjectedBlock(['uniform float b;']);

    expect(host.querySelectorAll('.cm-injected-block')).toHaveLength(1);
    expect(host.querySelector('.cm-injected-block')?.textContent).toContain(
      'uniform float b;',
    );

    manager.setInjectedBlock(null);

    expect(host.querySelector('.cm-injected-block')).toBeNull();
  });

  it('re-anchors when the header changes but keeps the block', () => {
    const { manager, host } = mountEditor();

    manager.setInjectedBlock(['uniform float a;']);
    manager.setValue(`// leading comment\n${DOC}`);

    const content = contentOf(host);
    const block = content.querySelector('.cm-injected-block');
    const precisionLine = [...content.querySelectorAll('.cm-line')].find(
      (line) => line.textContent?.includes('precision highp float;'),
    );

    expect(block).not.toBeNull();
    expect(precisionLine).toBeDefined();
    // The header grew by a comment, so the preview stays after precision.
    expect(
      block!.compareDocumentPosition(precisionLine!) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });
});
