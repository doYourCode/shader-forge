#!/usr/bin/env node
/**
 * Capture Screen Space Editor frames with Spector.js and write a summary per
 * scenario.
 *
 *   node tools/spector/capture.mjs --url http://localhost:5199
 *
 * Each scenario drives the real editor, captures the next GL frame and stores
 * the Spector summary (plus the trimmed command stream) under
 * `tools/spector/out/`. The JSON is the raw evidence; `analyze.mjs` turns it
 * into a report.
 */
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { launchBrowser } from './lib/chrome.mjs';
import {
  installSpector,
  openEditor,
  readStats,
  trackConsole,
} from './lib/editor.mjs';
import { captureFrameInPage } from './lib/page-capture.mjs';

const args = parseArgs(process.argv.slice(2));
const BASE_URL = args.url ?? process.env.SPECTOR_URL ?? 'http://localhost:5199';
const OUT_DIR = args.out ?? 'tools/spector/out';
const ONLY = args.scenario ? args.scenario.split(',') : null;
const CONTROL = args.control === 'true' || process.env.SPECTOR_CONTROL === '1';

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  if (CONTROL) {
    await runControl();
    return;
  }

  const results = [];

  for (const scenario of SCENARIOS) {
    if (ONLY && !ONLY.includes(scenario.id)) continue;
    const result = await runScenario(scenario);
    if (result) results.push(result);
  }

  const rows = compareCaptures(results);
  await writeFile(
    join(OUT_DIR, 'index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2),
  );

  log('\n--- per-frame comparison (Spector) ---');
  for (const row of rows) log(row);
}

/**
 * One browser per scenario.
 *
 * Spector attaches its spy to the canvas context and detaches it after the
 * capture. Re-attaching it after the editor recompiled its effect chain has
 * stalled on software GL, and a fresh page also guarantees that every scenario
 * starts from the same editor state.
 */
async function runScenario(scenario) {
  const { browser, page } = await launchBrowser({
    width: Number(args.width ?? 1600),
    height: Number(args.height ?? 1000),
  });
  page.setDefaultTimeout(60_000);
  const consoleLog = trackConsole(page);

  try {
    const { readyMs } = await openEditor(page, `${BASE_URL}/screen-space`);
    const spector = await installSpector(page);
    log(`\n=== ${scenario.id} - ${scenario.title} (ready in ${readyMs} ms)`);

    await timed('prepare', () => scenario.prepare(page));
    await timed('settle', () => settle(page));
    await timed('steady', () => waitForSteadyRendering(page));

    const before = await readStats(page);
    consoleLog.clear();

    const capture = await timed('capture', () =>
      captureSteadyFrame(page, {
        scenario: scenario.id,
        spectorVersion: spector.version,
        keepCommands: true,
        timeoutMs: 240_000,
      }),
    );

    try {
      await page.screenshot({ path: join(OUT_DIR, `${scenario.id}.png`) });
    } catch {
      log('  ! screenshot failed');
    }

    const after = await readStats(page);
    const faults = consoleLog.webGlFaults();
    const messages = consoleLog.summary().slice(0, 40);

    const record = {
      scenario: {
        id: scenario.id,
        title: scenario.title,
        notes: scenario.notes,
      },
      page: {
        statsBefore: before.stats,
        statsAfter: after.stats,
        uiErrors: after.errors,
        status: after.status,
      },
      console: {
        webGlFaultCount: faults.length,
        webGlFaults: summariseFaults(faults),
        messages,
      },
      capture,
    };

    await writeFile(
      join(OUT_DIR, `${scenario.id}.json`),
      JSON.stringify(record, null, 2),
    );

    log(
      `captured ${capture.commandCount} commands - ` +
        `${capture.draws.calls} draws - ${capture.draws.instances} instances - ` +
        `${capture.uniqueObjects.programs} programs - ` +
        `${capture.uniqueObjects.textures} textures - ` +
        `capture wall ${capture.clock.wallMs} ms`,
    );
    if (record.page.uiErrors.length) {
      log(`UI errors: ${record.page.uiErrors.join(' | ')}`);
    }
    if (faults.length) log(`WebGL faults: ${describeFaults(faults)}`);

    return { id: scenario.id, capture, page: record.page };
  } finally {
    await browser.close();
  }
}

/** Baseline with the same interactions and no Spector in the page. */
async function runControl() {
  const { browser, page } = await launchBrowser({
    width: Number(args.width ?? 1600),
    height: Number(args.height ?? 1000),
  });
  page.setDefaultTimeout(60_000);
  const consoleLog = trackConsole(page);

  try {
    const { readyMs } = await openEditor(page, `${BASE_URL}/screen-space`);
    await resetState(page);
    await page.locator('.post-effects__add').click();
    await settle(page);
    await resetState(page);
    await selectDebugMode(page, 2);
    await selectDebugMode(page, 0);
    const stats = await readStats(page);
    const faults = consoleLog.webGlFaults();
    const record = {
      generatedAt: new Date().toISOString(),
      readyMs,
      stats: stats.stats,
      webGlFaultCount: faults.length,
      webGlFaults: summariseFaults(faults),
      messages: consoleLog.summary().slice(0, 40),
    };
    await writeFile(
      join(OUT_DIR, 'control.json'),
      JSON.stringify(record, null, 2),
    );
    log(
      `control: ${faults.length} WebGL faults without Spector` +
        (faults.length ? ` (${describeFaults(faults)})` : ''),
    );
  } finally {
    await browser.close();
  }
}

function log(message) {
  process.stdout.write(`${message}\n`);
  appendFile(
    join(OUT_DIR, 'run.log'),
    `${new Date().toISOString()} ${message}\n`,
  ).catch(() => undefined);
}

/**
 * A frame with a handful of commands is a frame Babylon aborted before the
 * main pass (materials still compiling). Retry instead of reporting it.
 */
async function captureSteadyFrame(page, options, attempts = 3) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    last = await page.evaluate(captureFrameInPage, options);
    log(
      `  attempt ${attempt}: ${last.commandCount} commands, ` +
        `${last.draws.calls} draws in ${Date.now() - startedAt} ms`,
    );
    if (last.draws.calls >= 100) return last;
    await page.waitForTimeout(2500);
  }
  return last;
}

/** Waits until the overlay reports a frame rate the preview can hold. */
async function waitForSteadyRendering(page, quietMs = 6000) {
  await page.waitForTimeout(quietMs);
}

function describeFaults(faults) {
  return summariseFaults(faults)
    .map((fault) => `${fault.count} x ${fault.text}`)
    .join(' | ');
}

function summariseFaults(faults) {
  const groups = new Map();
  for (const fault of faults) {
    const key = fault.text.replace(/0x[0-9a-f]+/gi, '0x-').slice(0, 200);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.entries()].map(([text, count]) => ({ text, count }));
}

function compareCaptures(results) {
  return results.map(
    ({ id, capture, page }) =>
      `${id.padEnd(16)} commands=${capture.commandCount} ` +
      `draws=${capture.draws.calls} ` +
      `instances=${capture.draws.instances} ` +
      `programs=${capture.uniqueObjects.programs} ` +
      `textures=${capture.uniqueObjects.textures} ` +
      `overlay="${page.statsBefore ?? ''}"`,
  );
}

async function timed(label, run) {
  const startedAt = Date.now();
  log(`  > ${label}`);
  const value = await run();
  log(`  < ${label} (${Date.now() - startedAt} ms)`);
  return value;
}

async function settle(page) {
  // A compile flips the status bar to "Compiling" synchronously from the click
  // handler, so after a short grace period the only state to wait out is that
  // one. Switching tabs parks the status at "Idle", which is settled too.
  await page.waitForTimeout(700);
  try {
    await page.waitForFunction(
      () => {
        const text =
          document.querySelector('.status-bar__status')?.textContent ?? '';
        return !/Compiling/i.test(text);
      },
      undefined,
      { timeout: 120_000, polling: 250 },
    );
  } catch {
    log('  ! compile did not settle, continuing');
  }
  await page.waitForTimeout(1000);
}

async function resetState(page) {
  await page.locator('.ss-toolbar__tab').nth(0).click();

  const effects = page.locator('.post-effects__item');
  while ((await effects.count()) > 1) {
    await effects.last().locator('.post-effects__action--danger').click();
    await settle(page);
  }

  const enabled = page.locator('.post-effects__enabled').first();
  if (!(await enabled.isChecked())) {
    await enabled.check();
    await settle(page);
  }

  await page.locator('.ss-toolbar__tab').nth(2).click();
  const off = page.locator('.gbuffer-panel__mode').nth(0);
  if ((await off.getAttribute('aria-pressed')) !== 'true') {
    await off.click();
    await settle(page);
  }
  await page.locator('.ss-toolbar__tab').nth(0).click();
  await settle(page);
}

async function selectDebugMode(page, index) {
  await page.locator('.ss-toolbar__tab').nth(2).click();
  await page.locator('.gbuffer-panel__mode').nth(index).click();
  await settle(page);
  await page.locator('.ss-toolbar__tab').nth(0).click();
}

const SCENARIOS = [
  {
    id: 'idle',
    title: 'Steady state, passthrough effect, no G-buffer debug view',
    notes:
      'Baseline frame: scene + one fullscreen effect + display pass. No PrePass ' +
      'is expected because the passthrough effect samples no scene data.',
    prepare: async (page) => {
      await resetState(page);
    },
  },
  {
    id: 'effect-added',
    title: 'Two passthrough effect passes',
    notes:
      'Adds one fullscreen pass. The delta against idle is the per-effect ' +
      'fill cost plus one extra draw and program switch.',
    prepare: async (page) => {
      await page.locator('.post-effects__add').click();
      await settle(page);
    },
  },
  {
    id: 'effect-disabled',
    title: 'No effect passes, display pass only',
    notes:
      'Removes the extra effect and disables the remaining one: the scene is ' +
      'rendered and composited without any user pass.',
    prepare: async (page) => {
      await resetState(page);
      await page.locator('.post-effects__enabled').first().uncheck();
      await settle(page);
    },
  },
  {
    id: 'gbuffer-depth',
    title: 'G-buffer debug view: depth',
    notes:
      'Enables the PrePass with the single R32F depth attachment. This is the ' +
      'cheapest G-buffer layout.',
    prepare: async (page) => {
      await resetState(page);
      await selectDebugMode(page, 2);
    },
  },
  {
    id: 'gbuffer-normal',
    title: 'G-buffer debug view: normal',
    notes:
      'Enables the PrePass with the normal attachment next to depth; checks ' +
      'what an extra MRT attachment costs per frame.',
    prepare: async (page) => {
      await selectDebugMode(page, 3);
    },
  },
  {
    id: 'resize',
    title: 'Viewport resize with the G-buffer enabled',
    notes:
      'Shrinks the window while the PrePass is active: checks that every scene ' +
      'target follows the canvas and that no framebuffer keeps the old size.',
    prepare: async (page) => {
      await resetState(page);
      await selectDebugMode(page, 2);
      await page.setViewportSize({ width: 1100, height: 700 });
      await settle(page);
    },
  },
  {
    id: 'compile-error',
    title: 'Invalid effect source compiles to errors',
    notes:
      'A broken fragment must leave the previous chain rendering and report ' +
      'diagnostics without generating GL errors.',
    prepare: async (page) => {
      await resetState(page);
      await page.locator('.cm-content').first().click();
      await page.keyboard.press('Control+A');
      await page.keyboard.insertText('void main() {');
      await page.locator('.compile-button').click();
      await page.waitForFunction(
        () => !!document.querySelector('.screen-space__errors'),
        undefined,
        { timeout: 120_000, polling: 250 },
      );
      await settle(page);
    },
  },
];

function parseArgs(argv) {
  const parsed = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    parsed[key] = rest.length ? rest.join('=') : 'true';
  }
  return parsed;
}

// Keep this call last: the scenario table must be initialised first.
await main();
