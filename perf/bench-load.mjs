#!/usr/bin/env node
/**
 * Headless load benchmark for the shader preview.
 *
 * It drives the production build with Playwright, reads the load phases the app
 * publishes on `window.__shaderForgePerf` (see `src/services/perf/LoadProfiler`)
 * and reports the asset bytes the page actually transferred.
 *
 * Usage:
 *   npm run build
 *   npm run preview -- --port 4173 &
 *   node perf/bench-load.mjs --url http://127.0.0.1:4173
 *
 * Playwright is an optional developer dependency:
 *   npm i -D playwright && npx playwright install chromium
 *
 * Numbers from a headless run are meaningful for *relative* comparisons (before
 * vs after a change), not as absolute expectations for a real GPU.
 */
import { setTimeout as sleep } from 'node:timers/promises';

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.url ?? 'http://127.0.0.1:4173';
const timeoutMs = Number(args.timeout ?? 120_000);
const asJson = args.json === true;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright is not installed. Run:\n' +
      '  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(1);
}

const browser = await chromium.launch({
  headless: true,
  // Software GL so the benchmark also works on CI machines without a GPU.
  args: [
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--disable-gpu-sandbox',
  ],
});

const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});

const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

const result = { url: baseUrl, pageErrors };
const started = Date.now();

try {
  await page.goto(`${baseUrl}/editor?perf=1`, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });
  result.navigationMs = Date.now() - started;

  await page.waitForSelector('canvas.shader-editor__canvas', {
    timeout: timeoutMs,
  });
  result.canvasMs = Date.now() - started;

  await waitForIdlePreview(page, timeoutMs);
  result.firstPreviewReadyMs = Date.now() - started;

  const initSamples = await readSamples(page);
  result.initialSamples = initSamples;

  // ---- environment swap: last entry in the catalog ----
  const hdriSelect = page.locator('select.viewer-toolbar__hdri-select');
  const hdriValues = await hdriSelect
    .locator('option')
    .evaluateAll((options) => options.map((option) => option.value));
  const targetHdri = hdriValues[hdriValues.length - 1];

  const hdriSettledAt = await swapAndWait(page, () =>
    hdriSelect.selectOption(targetHdri),
  );
  result.hdriSwapMs = hdriSettledAt;
  result.hdriSwapSamples = await readSamples(page, initSamples.length);

  // ---- model swap: Dragon is the heaviest GLB in the catalog ----
  const modelSelect = page.locator('select.viewer-toolbar__model-select');
  const modelSettledAt = await swapAndWait(page, () =>
    modelSelect.selectOption('dragon'),
  );
  result.modelSwapMs = modelSettledAt;
  result.modelSwapSamples = await readSamples(
    page,
    initSamples.length + result.hdriSwapSamples.length,
  );

  result.resources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((entry) => /\.(hdr|env|glb)$/.test(entry.name))
      .map((entry) => ({
        file: entry.name.split('/').pop(),
        bytes: entry.encodedBodySize,
        ms: Math.round(entry.duration),
      })),
  );
} finally {
  await browser.close();
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  printReport(result);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

async function waitForIdlePreview(page, timeoutMs) {
  await page.waitForFunction(
    () => !document.querySelector('.shader-editor__loading'),
    null,
    { timeout: timeoutMs, polling: 50 },
  );
}

/** Runs a selection and returns how long the preview stayed busy. */
async function swapAndWait(page, action) {
  const startedAt = Date.now();
  await action();
  await sleep(50);
  await waitForIdlePreview(page, timeoutMs);
  return Date.now() - startedAt;
}

async function readSamples(page, from = 0) {
  return page.evaluate((offset) => {
    const perf = window.__shaderForgePerf;
    if (!perf) return [];
    return perf.samples().slice(offset).map((sample) => ({
      phase: sample.phase,
      ms: Math.round(sample.ms * 10) / 10,
    }));
  }, from);
}

function printReport(result) {
  const lines = [
    `ShaderForge load benchmark — ${result.url}`,
    '',
    `navigation → canvas      ${result.navigationMs} ms`,
    `navigation → preview     ${result.firstPreviewReadyMs} ms`,
    '',
    'Initial load phases:',
    ...formatSamples(result.initialSamples, '  '),
    '',
    `HDRI swap (settled)      ${result.hdriSwapMs} ms`,
    ...formatSamples(result.hdriSwapSamples, '  '),
    '',
    `Model swap (settled)     ${result.modelSwapMs} ms`,
    ...formatSamples(result.modelSwapSamples, '  '),
    '',
    'Transferred assets:',
    ...result.resources.map(
      (entry) =>
        `  ${entry.file.padEnd(40)} ${(entry.bytes / 1024).toFixed(0)} kB in ${entry.ms} ms`,
    ),
  ];

  if (result.pageErrors.length > 0) {
    lines.push('', 'Page errors:', ...result.pageErrors.map((e) => `  ${e}`));
  }

  console.log(lines.join('\n'));
}

function formatSamples(samples, prefix) {
  if (samples.length === 0) return [`${prefix}(no samples)`];
  return samples.map(
    (sample) => `${prefix}${sample.phase.padEnd(18)} ${sample.ms} ms`,
  );
}
