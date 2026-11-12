import { Engine, HDRCubeTexture, Scene } from '@babylonjs/core';
import { CreateEnvTextureAsync } from '@babylonjs/core/Misc/environmentTextureTools';
import {
  IBL_FILTERING_QUALITY,
  prefilterEnvironmentTexture,
} from '@/services/babylon/preview/IblFiltering';
import { envFileNameFor, hdriBakeSources } from './hdriSources';

/**
 * Face size of the baked cubemap. Must stay in sync with the runtime
 * `HDR_CUBE_SIZE` so a baked environment matches what the live filter produced.
 */
const FACE_SIZE = 512;
const IMAGE_TYPE = 'image/webp';
const IMAGE_QUALITY = 0.92;

export interface BakeTimings {
  /** HDR fetch + RGBE decode + panorama→cubemap. */
  readonly loadMs: number;
  /** Irradiance convolution + GGX radiance prefilter. */
  readonly filterMs: number;
  /** Per-face/mip readback, RGBD encode and WebP encode. */
  readonly encodeMs: number;
  readonly totalMs: number;
}

export interface BakeArtifact {
  readonly id: string;
  readonly fileName: string;
  readonly bytes: number;
  readonly base64: string;
  readonly timings: BakeTimings;
}

export interface BakeOptions {
  readonly onProgress?: (message: string) => void;
}

function loadHdrCubeTexture(
  scene: Scene,
  url: string,
): Promise<HDRCubeTexture> {
  return new Promise((resolve, reject) => {
    let texture: HDRCubeTexture;
    texture = new HDRCubeTexture(
      url,
      scene,
      FACE_SIZE,
      false,
      true,
      false,
      false,
      () => resolve(texture),
      (message) => reject(new Error(String(message ?? 'HDR load failed'))),
    );
  });
}

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

/**
 * Bakes every catalog environment into Babylon's prefiltered `.env` container.
 *
 * The pipeline is the runtime one, executed once offline:
 * HDR fetch → RGBE decode → panorama→cubemap → irradiance convolution → GGX
 * radiance prefilter → RGBD/WebP encode → `.env` header + payload.
 */
export async function bakeAll(options: BakeOptions = {}): Promise<BakeArtifact[]> {
  const report = options.onProgress ?? (() => {});
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: true,
    stencil: false,
    antialias: false,
  });
  const scene = new Scene(engine);
  const artifacts: BakeArtifact[] = [];

  try {
    for (const source of hdriBakeSources) {
      report(`Loading ${source.id}…`);
      const started = performance.now();

      const texture = await loadHdrCubeTexture(scene, source.sourceUrl);
      const loadedAt = performance.now();

      try {
        await prefilterEnvironmentTexture(
          engine,
          texture,
          IBL_FILTERING_QUALITY,
        );
        const filteredAt = performance.now();

        const data = await CreateEnvTextureAsync(texture, {
          imageType: IMAGE_TYPE,
          imageQuality: IMAGE_QUALITY,
        });
        const encodedAt = performance.now();

        const bytes = new Uint8Array(data);
        const artifact: BakeArtifact = {
          id: source.id,
          fileName: envFileNameFor(source.id),
          bytes: bytes.byteLength,
          base64: toBase64(bytes),
          timings: {
            loadMs: Math.round(loadedAt - started),
            filterMs: Math.round(filteredAt - loadedAt),
            encodeMs: Math.round(encodedAt - filteredAt),
            totalMs: Math.round(encodedAt - started),
          },
        };
        artifacts.push(artifact);
        report(
          `${artifact.fileName}: ${(artifact.bytes / 1048576).toFixed(2)} MB ` +
            `(${artifact.timings.totalMs} ms)`,
        );
      } finally {
        texture.dispose();
      }
    }
  } finally {
    scene.dispose();
    engine.dispose();
  }

  return artifacts;
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

  const download = (artifact: BakeArtifact): void => {
    const binary = atob(artifact.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const url = URL.createObjectURL(
      new Blob([bytes], { type: 'application/octet-stream' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  bakeButton?.addEventListener('click', async () => {
    if (!bakeButton || !results) return;

    bakeButton.setAttribute('disabled', 'true');
    results.replaceChildren();
    append('Baking…');

    try {
      const artifacts = await bakeAll({ onProgress: append });
      for (const artifact of artifacts) {
        const row = document.createElement('div');
        const label = document.createElement('code');
        label.textContent = `${artifact.fileName} — ${(
          artifact.bytes / 1048576
        ).toFixed(2)} MB`;

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'download';
        button.addEventListener('click', () => download(artifact));

        row.append(label, button);
        results.appendChild(row);
      }
      append('Done. Save the files next to the HDR catalog imports.');
    } catch (error) {
      append(`Failed: ${(error as Error).message}`);
    } finally {
      bakeButton.removeAttribute('disabled');
    }
  });
}

declare global {
  interface Window {
    /** Automation hook used by the bake verification harness. */
    __shaderForgeBake?: { bakeAll: typeof bakeAll };
  }
}

window.__shaderForgeBake = { bakeAll };
mountUi();
