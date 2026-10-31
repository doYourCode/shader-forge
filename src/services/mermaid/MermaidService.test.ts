// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MERMAID_SOURCE_ATTRIBUTE,
  MERMAID_STATE_ATTRIBUTE,
} from '@/core/content/mermaid';
import { MermaidService, type MermaidLoader } from './MermaidService';

const SOURCE = 'flowchart LR\n  A --> B';

function createMermaid() {
  return {
    initialize: vi.fn(),
    render: vi.fn(async (id: string, text: string) => ({
      svg: `<svg data-id="${id}"><title>${text}</title></svg>`,
    })),
  };
}

function createRoot(source = SOURCE): {
  root: HTMLElement;
  diagram: HTMLElement;
} {
  const root = document.createElement('div');
  root.innerHTML =
    `<div class="mermaid-diagram" ${MERMAID_SOURCE_ATTRIBUTE}="${source}"` +
    ' aria-busy="true"></div>';
  document.body.append(root);

  return {
    root,
    diagram: root.querySelector<HTMLElement>('.mermaid-diagram')!,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('MermaidService', () => {
  it('renders every placeholder and initialises Mermaid only once', async () => {
    const mermaid = createMermaid();
    const loadModule = vi.fn<MermaidLoader>(async () => mermaid);
    const service = new MermaidService(loadModule);
    const { root, diagram } = createRoot();

    await service.renderAll(root);
    await service.renderAll(root);

    expect(loadModule).toHaveBeenCalledTimes(1);
    expect(mermaid.initialize).toHaveBeenCalledTimes(1);
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ startOnLoad: false, securityLevel: 'strict' }),
    );
    expect(mermaid.render).toHaveBeenCalledTimes(1);
    expect(diagram.getAttribute(MERMAID_STATE_ATTRIBUTE)).toBe('rendered');
    expect(diagram.getAttribute('aria-busy')).toBeNull();
    expect(diagram.querySelector('svg')).not.toBeNull();
  });

  it('does not render the same placeholder twice when calls overlap', async () => {
    const mermaid = createMermaid();
    const service = new MermaidService(async () => mermaid);
    const { root } = createRoot();

    await Promise.all([service.renderAll(root), service.renderAll(root)]);

    expect(mermaid.render).toHaveBeenCalledTimes(1);
  });

  it('degrades to a readable error that keeps the diagram source', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const mermaid = createMermaid();
    mermaid.render.mockRejectedValueOnce(new Error('Parse error'));
    const service = new MermaidService(async () => mermaid);
    const { root, diagram } = createRoot();

    await service.renderAll(root);

    expect(diagram.getAttribute(MERMAID_STATE_ATTRIBUTE)).toBe('error');
    expect(diagram.getAttribute('aria-busy')).toBeNull();
    expect(diagram.querySelector('.mermaid-diagram__error')).not.toBeNull();
    expect(diagram.textContent).toContain(
      'This diagram could not be rendered.',
    );
    expect(diagram.textContent).toContain(SOURCE);
    expect(consoleError).toHaveBeenCalled();
  });

  it('reports a chunk load failure on every placeholder', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = new MermaidService(async () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const { root, diagram } = createRoot();

    await service.renderAll(root);

    expect(diagram.getAttribute(MERMAID_STATE_ATTRIBUTE)).toBe('error');
    expect(diagram.textContent).toContain(SOURCE);
  });

  it('ignores placeholders detached before rendering starts', async () => {
    const mermaid = createMermaid();
    const loadModule = vi.fn<MermaidLoader>(async () => mermaid);
    const service = new MermaidService(loadModule);
    const { root, diagram } = createRoot();

    diagram.remove();
    await service.renderAll(root);

    expect(loadModule).not.toHaveBeenCalled();
    expect(mermaid.render).not.toHaveBeenCalled();
  });
});
