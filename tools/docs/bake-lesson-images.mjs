#!/usr/bin/env node
/**
 * Bakes the images used by the lessons.
 *
 *   npm run docs:images
 *
 * It starts Vite, opens the real preview pages in headless Chromium and writes:
 *   src/assets/examples/thumbs/<id>.webp   (3D picker previews)
 *   public/images/content/lessons/*.webp   (lesson screenshots from the bakers)
 *   public/images/content/lessons/*.png    (editor canvas screenshots)
 *
 * The screenshots are produced by the same preview pipeline the readers use, so
 * a lesson cannot show an image the app cannot render. The script is dev-only
 * and is not part of the production build.
 */
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createServer } from 'vite';

import { launchBrowser } from '../../tools/spector/lib/chrome.mjs';

const ROOT = process.cwd();
const LESSON_DIR = join(ROOT, 'public/images/content/lessons');
const EXAMPLE_THUMB_DIR = join(ROOT, 'src/assets/examples/thumbs');

const MATERIAL_EXAMPLES = [
  'lambert',
  'phong',
  'blinn-phong',
  'oren-nayar',
  'cook-torrance',
  'toon',
  'rim-light',
  'normal-map',
  'displacement',
  'reflections',
  'ibl-metalness-roughness',
  'ibl-specular-glossiness',
];

const SURFACE_EFFECTS = ['vignette', 'blur', 'depth-fog'];
const SCREEN_SPACE_EFFECTS = [
  'gbuffer-normal',
  'gbuffer-depth',
  'gbuffer-albedo',
  'gbuffer-roughness',
  'gbuffer-velocity',
  'edge-outline',
  'ssao',
];

/** `DOC_BAKE_ONLY=sandbox` skips the other groups (useful while iterating). */
const ONLY = process.env.DOC_BAKE_ONLY ?? '';

function dataUrlToBuffer(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Expected a data URL.');
  return Buffer.from(dataUrl.slice(comma + 1), 'base64');
}

async function writeDataUrl(path, dataUrl) {
  await writeFile(path, dataUrlToBuffer(dataUrl));
  console.log(`  ${path.replace(`${ROOT}\\`, '').replaceAll('\\', '/')}`);
}

async function bakeStatic(page, url, hookName) {
  await page.goto(`${url}/example-thumb-bake.html`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    (name) => Boolean(window[name]),
    hookName,
    { timeout: 60_000 },
  );

  const artifacts = await page.evaluate(
    (name) => window[name].bakeAll(),
    hookName,
  );

  return artifacts;
}

async function bakeSandbox(page, url) {
  await page.goto(`${url}/sandbox-thumb-bake.html`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => Boolean(window.__shaderForgeSandboxBake),
    undefined,
    { timeout: 60_000 },
  );

  return page.evaluate(() =>
    window.__shaderForgeSandboxBake.bakeAll(),
  );
}

async function waitFor3dEditor(page) {
  await page.waitForSelector('canvas.shader-editor__canvas', {
    timeout: 60_000,
  });
  await page.waitForFunction(
    () => {
      const status = document.querySelector('.status-bar__status');
      const text = status?.textContent ?? '';
      return (
        !document.querySelector('.shader-editor__loading') &&
        !document.querySelector('.shader-editor__errors') &&
        /Ready|Pronto/.test(text)
      );
    },
    undefined,
    { timeout: 120_000, polling: 250 },
  );
  await page.waitForTimeout(1_500);
}

async function capture3dEffect(page, url, id) {
  await page.goto(`${url}/editor?effect=${id}`, {
    waitUntil: 'domcontentloaded',
  });
  await waitFor3dEditor(page);

  // The lesson image is the render, not the preview chrome. The scene panel is
  // an overlay inside the canvas box, so hide it before the canvas screenshot.
  await page.addStyleTag({
    content: '.viewer-scene-panel { display: none !important; }',
  });
  await page.waitForTimeout(250);

  await page.locator('canvas.shader-editor__canvas').screenshot({
    path: join(LESSON_DIR, `${id}.png`),
  });
  console.log(`  public/images/content/lessons/${id}.png`);
}

/**
 * Converts a PNG screenshot to a cover-cropped 320×200 WebP in the browser.
 * The example picker expects WebP; the lesson page keeps the full PNG.
 */
async function toExampleWebp(page, pngBuffer, width = 320, height = 200) {
  const dataUrl = await page.evaluate(
    async ({ base64, width, height }) => {
      const image = document.createElement('img');
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return null;

      const scale = Math.max(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      context.drawImage(
        image,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );

      return canvas.toDataURL('image/webp', 0.9);
    },
    { base64: pngBuffer.toString('base64'), width, height },
  );

  if (!dataUrl) throw new Error('The browser could not encode the WebP.');
  return dataUrl;
}

/**
 * Captures a bundled material example from the real editor. This path is used
 * for the lesson images because it gives each example a fresh page and avoids
 * exhausting WebGL contexts when twelve examples are baked in one page.
 */
async function captureEditorExample(page, url, id) {
  await page.goto(`${url}/editor?example=${id}`, {
    waitUntil: 'domcontentloaded',
  });
  await waitFor3dEditor(page);
  await page.addStyleTag({
    content: '.viewer-scene-panel { display: none !important; }',
  });
  await page.waitForTimeout(250);

  const canvas = page.locator('canvas.shader-editor__canvas');
  const png = await canvas.screenshot();

  await writeFile(join(LESSON_DIR, `${id}.png`), png);
  console.log(`  public/images/content/lessons/${id}.png`);

  const webp = await toExampleWebp(page, png);
  await writeDataUrl(join(EXAMPLE_THUMB_DIR, `${id}.webp`), webp);
}

async function waitForScreenSpace(page) {
  await page.waitForSelector('canvas.screen-space__canvas', {
    timeout: 60_000,
  });
  await page.waitForFunction(
    () => {
      const loading = document.querySelector('.screen-space__loading');
      const stats = document.querySelector('.screen-space__stats');
      const errors = document.querySelector('.screen-space__error');
      return !loading && !!stats?.textContent && !errors;
    },
    undefined,
    { timeout: 180_000, polling: 250 },
  );
  await page.waitForTimeout(2_000);
}

async function captureScreenSpace(page, url, id) {
  await page.goto(`${url}/screen-space?example=${id}`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForScreenSpace(page);

  // Hide the in-canvas overlays so the lesson shows the attachment, not the
  // editor's stats and lighting controls.
  await page.addStyleTag({
    content:
      '.screen-space__stats, .screen-space__hint, .gbuffer-overlay, .lighting-overlay { display: none !important; }',
  });
  await page.waitForTimeout(250);

  await page.locator('canvas.screen-space__canvas').screenshot({
    path: join(LESSON_DIR, `${id}.png`),
  });
  console.log(`  public/images/content/lessons/${id}.png`);
}

async function main() {
  await mkdir(LESSON_DIR, { recursive: true });
  await mkdir(EXAMPLE_THUMB_DIR, { recursive: true });

  const server = await createServer({
    server: { port: 0, strictPort: false },
    logLevel: 'error',
  });

  await server.listen();
  const base = server.resolvedUrls?.local?.[0];
  if (!base) throw new Error('Vite did not report a local URL.');
  const url = base.replace(/\/$/, '');

  const { browser, page } = await launchBrowser({ width: 1600, height: 1000 });
  page.setDefaultTimeout(120_000);

  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  try {
    // The per-page material baker is kept for diagnostics; the default path
    // uses the editor capture below, which starts a fresh page per example.
    if (ONLY === 'material') {
      console.log('Baking 3D material examples (single-page baker)…');
      const materialArtifacts = await bakeStatic(
        page,
        url,
        '__shaderForgeExampleBake',
      );

      for (const artifact of materialArtifacts) {
        await writeDataUrl(
          join(LESSON_DIR, artifact.fileName),
          artifact.dataUrl,
        );
        await writeDataUrl(
          join(EXAMPLE_THUMB_DIR, artifact.fileName),
          artifact.dataUrl,
        );
      }
    }

    if (!ONLY || ONLY === 'sandbox') {
      console.log('Baking sandbox examples…');
      const sandboxArtifacts = await bakeSandbox(page, url);
      for (const artifact of sandboxArtifacts) {
        await writeDataUrl(
          join(LESSON_DIR, artifact.fileName),
          artifact.dataUrl,
        );
      }
    }

    if (!ONLY || ONLY === 'examples-editor') {
      console.log('Capturing material examples from the editor…');
      for (const id of MATERIAL_EXAMPLES) {
        await captureEditorExample(page, url, id);
      }
    }

    if (!ONLY || ONLY === 'effects') {
      console.log('Capturing surface post effects…');
      for (const id of SURFACE_EFFECTS) {
        await capture3dEffect(page, url, id);
      }
    }

    if (!ONLY || ONLY === 'screen-space') {
      console.log('Capturing screen-space examples…');
      for (const id of SCREEN_SPACE_EFFECTS) {
        await captureScreenSpace(page, url, id);
      }
    }

    if (consoleErrors.length > 0) {
      throw new Error(
        `The page reported ${consoleErrors.length} error(s):\n${consoleErrors.join('\n')}`,
      );
    }

    console.log('Done.');
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
