import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Browser-side console, grouped by a normalised message. */
export function trackConsole(page) {
  const entries = [];

  page.on('console', (message) => {
    entries.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => {
    entries.push({ type: 'pageerror', text: error.message });
  });

  return {
    entries,
    clear() {
      entries.length = 0;
    },
    /** Messages that indicate a GL/WebGL fault rather than a driver hint. */
    webGlFaults() {
      return entries.filter(
        (entry) =>
          /WebGL:\s*(INVALID|CONTEXT_LOST|INVALID_OPERATION|OUT_OF_MEMORY)/i.test(
            entry.text,
          ) || /GL_INVALID|GL_OUT_OF_MEMORY/i.test(entry.text),
      );
    },
    /** One row per distinct message, most frequent first. */
    summary() {
      const groups = new Map();
      for (const entry of entries) {
        const key = `${entry.type}\u0000${normalise(entry.text)}`;
        const group = groups.get(key);
        if (group) {
          group.count += 1;
        } else {
          groups.set(key, {
            type: entry.type,
            text: normalise(entry.text),
            count: 1,
          });
        }
      }
      return [...groups.values()].sort((a, b) => b.count - a.count);
    },
  };
}

/** Drops run-specific noise so repeated messages collapse into one row. */
function normalise(text) {
  return text
    .replace(/0x[0-9a-f]+/gi, '0x...')
    .replace(/\[\d\d:\d\d:\d\d\]/g, '[time]')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function openEditor(page, url) {
  const startedAt = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('canvas.screen-space__canvas', {
    timeout: 60_000,
  });

  // The preview is ready when the loading banner is gone and the stats overlay
  // has a sample: both are driven by the running render loop.
  await page.waitForFunction(
    () => {
      const loading = document.querySelector('.screen-space__loading');
      const stats = document.querySelector('.screen-space__stats');
      return !loading && !!stats?.textContent;
    },
    undefined,
    {
      timeout: Number(process.env.SPECTOR_READY_TIMEOUT ?? 300_000),
      polling: 500,
    },
  );

  const readyMs = Date.now() - startedAt;
  await page.waitForTimeout(Number(process.env.SPECTOR_SETTLE_MS ?? 2500));

  return { readyMs };
}

/** The stats overlay the editor prints under the canvas. */
export async function readStats(page) {
  return page.evaluate(() => {
    const text = document.querySelector('.screen-space__stats')?.textContent;
    const errors = [...document.querySelectorAll('.screen-space__error')].map(
      (node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
    const status = document.querySelector('.screen-space__status')?.textContent;
    return {
      stats: text?.trim() ?? null,
      errors,
      status: status?.replace(/\s+/g, ' ').trim() ?? null,
    };
  });
}

/** Injects the Spector.js browser bundle and exposes `window.SPECTOR`. */
export async function installSpector(page) {
  const bundle = require.resolve('spectorjs');
  await page.addScriptTag({ path: bundle });
  const version = JSON.parse(
    readFileSync(require.resolve('spectorjs/package.json'), 'utf8'),
  ).version;
  return { bundle, version };
}
