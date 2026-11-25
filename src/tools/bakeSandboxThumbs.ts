import { sandboxExamples } from '@/core/constants/sandboxExamples';
import { sandboxVertexSource } from '@/core/constants/sandbox';
import { SandboxPreview } from '@/services/sandbox/SandboxPreview';

/**
 * Dev-only sandbox thumbnail baker. It renders every bundled sandbox example
 * through the real preview and returns a WebP per example. The docs bake
 * script downloads the results into `public/images/content/lessons/`.
 */

const THUMB_WIDTH = 640;
const THUMB_HEIGHT = 400;

export interface SandboxThumbArtifact {
  readonly id: string;
  readonly fileName: string;
  readonly dataUrl: string;
}

export async function bakeAllSandbox(
  onProgress: (message: string) => void = () => undefined,
): Promise<SandboxThumbArtifact[]> {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_WIDTH;
  canvas.height = THUMB_HEIGHT;
  canvas.style.width = `${THUMB_WIDTH}px`;
  canvas.style.height = `${THUMB_HEIGHT}px`;
  canvas.style.display = 'block';
  document.body.append(canvas);

  const preview = new SandboxPreview(canvas);
  const artifacts: SandboxThumbArtifact[] = [];

  try {
    for (const example of sandboxExamples) {
      onProgress(`Rendering ${example.id}…`);

      const result = preview.compile({
        vertex: sandboxVertexSource,
        fragment: example.fragment,
        editorSource: {
          vertex: sandboxVertexSource,
          fragment: example.fragment,
        },
        extraUniforms: [],
        extraSamplers: [],
      });

      if (result.status !== 'ok') {
        const details =
          result.status === 'failed'
            ? result.errors
                .map((error) =>
                  [error.title, error.message, error.advice]
                    .filter(Boolean)
                    .join(' — '),
                )
                .join('\n')
            : `unavailable: ${result.reason}`;
        throw new Error(
          `The sandbox rejected the "${example.id}" example.\n${details}`,
        );
      }

      // Let the compositor present the frame before reading it back.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );

      const dataUrl = preview.capture();
      if (!dataUrl) {
        throw new Error(`The sandbox rendered no frame for "${example.id}".`);
      }

      artifacts.push({
        id: example.id,
        fileName: `${example.id}.webp`,
        dataUrl,
      });
      onProgress(`${example.id}.webp ready`);
    }
  } finally {
    preview.dispose();
    canvas.remove();
  }

  return artifacts;
}

declare global {
  interface Window {
    /** Automation hook used by the docs image bake script. */
    __shaderForgeSandboxBake?: { bakeAll: typeof bakeAllSandbox };
  }
}

window.__shaderForgeSandboxBake = { bakeAll: bakeAllSandbox };

const output = document.getElementById('out');
const log = (message: string): void => {
  if (output) output.textContent = message;
};

document.getElementById('bake')?.addEventListener('click', () => {
  void bakeAllSandbox(log).then((artifacts) => {
    const target = document.getElementById('results');
    if (!target) return;

    target.replaceChildren();
    for (const artifact of artifacts) {
      const image = document.createElement('img');
      image.src = artifact.dataUrl;
      image.alt = artifact.id;
      image.width = 160;
      target.append(image);
    }
  });
});
