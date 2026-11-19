import { previewHdris } from '@/core/constants/previewHdris';
import { previewModels } from '@/core/constants/previewModels';
import {
  shaderExamples,
  type ShaderExample,
} from '@/core/constants/shaderExamples';
import { SceneManager } from '@/services/babylon/SceneManager';
import { createRenderTargetSnapshot } from '@/services/babylon/preview/snapshot/PreviewSnapshot';
import type { ShaderSource } from '@/core/models/shaderSource';
import { UserDataController } from '@/services/userdata/UserDataController';

/**
 * Size of one baked grid preview. The picker renders tiles around 120 px wide,
 * so 2x keeps them crisp on high-density displays without bloating the bundle.
 */
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 200;

export interface ExampleThumbArtifact {
  readonly id: string;
  readonly fileName: string;
  /** `data:image/webp;base64,…` rendered by the preview pipeline. */
  readonly dataUrl: string;
}

export interface ExampleBakeOptions {
  readonly onProgress?: (message: string) => void;
}

/**
 * Renders one example through the real preview pipeline and returns its grid
 * preview. The example's user-data parameters are seeded exactly as the loader
 * seeds them, so the baked image matches what selecting the example produces.
 */
export async function bakeExampleThumb(
  example: ShaderExample,
): Promise<ExampleThumbArtifact> {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_WIDTH;
  canvas.height = THUMB_HEIGHT;

  const sources: ShaderSource = {
    vertex: example.vertex,
    fragment: example.fragment,
  };

  const userData = new UserDataController({
    getSources: () => sources,
    // The bake compiles once, through `init`; no debounced request is wanted.
    onCompileRequested: () => undefined,
    schedule: () => () => undefined,
  });
  userData.replaceAll(example.uniforms);

  // Only the bake tool needs screenshot support, so it injects the snapshot
  // factory instead of the runtime facade carrying bake-only code.
  const manager = new SceneManager(
    undefined,
    undefined,
    undefined,
    createRenderTargetSnapshot,
  );
  try {
    await manager.init(
      canvas,
      userData.buildBlueprint(sources),
      previewModels.default,
      previewHdris.default,
      userData,
    );

    const dataUrl = await manager.snapshot?.capture(THUMB_WIDTH, THUMB_HEIGHT);
    if (!dataUrl) {
      throw new Error(`The preview rendered no frame for "${example.id}".`);
    }

    return { id: example.id, fileName: `${example.id}.webp`, dataUrl };
  } finally {
    manager.dispose();
    userData.dispose();
  }
}

/** Bakes every catalog example, reporting per-example progress. */
export async function bakeAll(
  options: ExampleBakeOptions = {},
): Promise<ExampleThumbArtifact[]> {
  const report = options.onProgress ?? (() => undefined);
  const artifacts: ExampleThumbArtifact[] = [];

  for (const example of shaderExamples) {
    report(`Rendering ${example.id}…`);

    try {
      const artifact = await bakeExampleThumb(example);
      artifacts.push(artifact);
      report(`${artifact.fileName} ready`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report(`${example.id}: ${message}`);
    }
  }

  return artifacts;
}

function download(artifact: ExampleThumbArtifact): void {
  const anchor = document.createElement('a');
  anchor.href = artifact.dataUrl;
  anchor.download = artifact.fileName;
  anchor.click();
}

function mountUi(): void {
  const log = document.getElementById('log');
  const bakeButton = document.getElementById('bake');
  const results = document.getElementById('results');

  const append = (message: string): void => {
    if (!log) return;

    const line = document.createElement('div');
    line.textContent = message;
    log.appendChild(line);
  };

  const runBake = async (): Promise<void> => {
    if (!bakeButton || !results) return;

    bakeButton.setAttribute('disabled', 'true');
    results.replaceChildren();
    append('Baking…');

    try {
      const artifacts = await bakeAll({ onProgress: append });

      for (const artifact of artifacts) {
        const row = document.createElement('div');

        const preview = document.createElement('img');
        preview.src = artifact.dataUrl;
        preview.alt = '';
        preview.width = 96;

        const label = document.createElement('code');
        label.textContent = artifact.fileName;

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'download';
        button.addEventListener('click', () => download(artifact));

        row.append(preview, label, button);
        results.appendChild(row);
      }

      append(
        `Done. Save the files under src/assets/examples/thumbs/ (${artifacts.length}/${shaderExamples.length}).`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      append(`Failed: ${message}`);
    } finally {
      bakeButton.removeAttribute('disabled');
    }
  };

  bakeButton?.addEventListener('click', () => {
    void runBake();
  });
}

declare global {
  interface Window {
    /** Automation hook used by the bake verification harness. */
    __shaderForgeExampleBake?: { bakeAll: typeof bakeAll };
  }
}

window.__shaderForgeExampleBake = { bakeAll };
mountUi();
