import type { MermaidConfig, RenderResult } from 'mermaid';

import {
  MERMAID_SOURCE_ATTRIBUTE,
  MERMAID_STATE_ATTRIBUTE,
} from '@/core/content/mermaid';

/**
 * Minimal surface of Mermaid's public API used here. Keeping the dependency
 * behind an interface lets the renderer be tested without a browser SVG engine
 * and keeps the rendering policy (laziness, idempotence, fallbacks) local.
 */
export interface MermaidModule {
  initialize(config: MermaidConfig): void;
  render(
    id: string,
    text: string,
  ): Promise<Pick<RenderResult, 'svg' | 'bindFunctions'>>;
}

export type MermaidLoader = () => Promise<MermaidModule>;

const MONOSPACE_FONT =
  'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

/**
 * The "base" theme puts diagram colours under our control instead of shipping
 * a light palette that clashes with the One Dark shell. Values mirror the
 * `--bg*`, `--fg*` and `--accent-*` custom properties in `src/style.css`.
 */
const MERMAID_CONFIG: MermaidConfig = {
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'base',
  fontFamily: MONOSPACE_FONT,
  fontSize: 14,
  htmlLabels: true,
  themeVariables: {
    darkMode: true,
    fontFamily: MONOSPACE_FONT,
    fontSize: '14px',
    background: '#282c34',
    mainBkg: '#2c313c',
    primaryColor: '#2c313c',
    primaryTextColor: '#d7dae0',
    primaryBorderColor: '#61afef',
    secondaryColor: '#21252b',
    secondaryTextColor: '#abb2bf',
    secondaryBorderColor: '#3e4452',
    tertiaryColor: '#1d1f23',
    tertiaryTextColor: '#abb2bf',
    tertiaryBorderColor: '#3e4452',
    textColor: '#abb2bf',
    lineColor: '#7f848e',
    nodeBorder: '#61afef',
    nodeTextColor: '#d7dae0',
    edgeLabelBackground: '#282c34',
    clusterBkg: '#21252b',
    clusterBorder: '#3e4452',
    titleColor: '#d7dae0',
    actorBkg: '#2c313c',
    actorBorder: '#61afef',
    actorTextColor: '#d7dae0',
    actorLineColor: '#7f848e',
    signalColor: '#abb2bf',
    signalTextColor: '#abb2bf',
    labelBoxBkgColor: '#2c313c',
    labelBoxBorderColor: '#61afef',
    labelTextColor: '#d7dae0',
    loopTextColor: '#abb2bf',
    noteBkgColor: '#2c313c',
    noteTextColor: '#d7dae0',
    noteBorderColor: '#e5c07b',
    activationBkgColor: '#2c313c',
    activationBorderColor: '#98c379',
    sequenceNumberColor: '#282c34',
  },
};

let nextDiagramId = 0;

function defaultLoadMermaid(): Promise<MermaidModule> {
  return import('mermaid').then(({ default: mermaid }) => mermaid);
}

/**
 * Hydrates Mermaid placeholders emitted by the markdown renderer.
 *
 * Rendering is lazy (the Mermaid bundle is fetched only when a document really
 * contains a diagram), idempotent per placeholder, and never throws: a broken
 * diagram degrades to a visible message plus its source, so the rest of the
 * document remains readable.
 */
export class MermaidService {
  private readonly loadModule: MermaidLoader;
  private modulePromise: Promise<MermaidModule> | null = null;

  constructor(loadModule: MermaidLoader = defaultLoadMermaid) {
    this.loadModule = loadModule;
  }

  async renderAll(root: ParentNode): Promise<void> {
    const placeholders = Array.from(
      root.querySelectorAll<HTMLElement>(`[${MERMAID_SOURCE_ATTRIBUTE}]`),
    ).filter(
      (node) =>
        node.isConnected && !node.getAttribute(MERMAID_STATE_ATTRIBUTE),
    );

    if (placeholders.length === 0) return;

    // Claim every placeholder before awaiting the chunk so overlapping render
    // passes (or two panes on the same document) cannot render it twice.
    for (const node of placeholders) {
      node.setAttribute(MERMAID_STATE_ATTRIBUTE, 'pending');
    }

    let mermaid: MermaidModule;
    try {
      mermaid = await this.load();
    } catch (error) {
      for (const node of placeholders) {
        this.showError(node, diagramSource(node), error);
      }
      return;
    }

    for (const node of placeholders) {
      // The pane may have swapped documents while the module was loading.
      if (!node.isConnected) continue;
      await this.renderOne(node, mermaid);
    }
  }

  private load(): Promise<MermaidModule> {
    this.modulePromise ??= this.loadModule()
      .then((mermaid) => {
        mermaid.initialize(MERMAID_CONFIG);
        return mermaid;
      })
      .catch((error: unknown) => {
        // Do not cache a failed chunk load: a later document may retry.
        this.modulePromise = null;
        throw error;
      });

    return this.modulePromise;
  }

  private async renderOne(
    node: HTMLElement,
    mermaid: MermaidModule,
  ): Promise<void> {
    const source = diagramSource(node);
    node.setAttribute(MERMAID_STATE_ATTRIBUTE, 'rendering');

    try {
      const { svg, bindFunctions } = await mermaid.render(
        `mermaid-diagram-${++nextDiagramId}`,
        source,
      );

      if (!node.isConnected) return;

      node.innerHTML = svg;
      node.removeAttribute('aria-busy');
      node.setAttribute(MERMAID_STATE_ATTRIBUTE, 'rendered');
      bindFunctions?.(node);
    } catch (error) {
      this.showError(node, source, error);
    }
  }

  private showError(node: HTMLElement, source: string, error: unknown): void {
    if (!node.isConnected) return;

    console.error('[mermaid] Failed to render diagram', error);

    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid-diagram__error';
    wrapper.setAttribute('role', 'alert');

    const title = document.createElement('p');
    title.className = 'mermaid-diagram__error-title';
    title.textContent = 'This diagram could not be rendered.';

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = source;
    pre.append(code);

    wrapper.append(title, pre);
    node.replaceChildren(wrapper);
    node.removeAttribute('aria-busy');
    node.setAttribute(MERMAID_STATE_ATTRIBUTE, 'error');
  }
}

function diagramSource(node: HTMLElement): string {
  return node.getAttribute(MERMAID_SOURCE_ATTRIBUTE) ?? '';
}

/** Shared instance: Mermaid owns global configuration and parser state. */
export const mermaidService = new MermaidService();
