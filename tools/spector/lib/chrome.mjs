import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

/**
 * Chromium executable used for captures.
 *
 * Spector reads the real GL command stream, so the browser must expose WebGL 2
 * even on a machine without a usable GPU. Playwright's bundled Chromium plus
 * ANGLE/SwiftShader is enough: the numbers are meaningless for absolute
 * performance (see `docs/performance.md`) but the command stream is real.
 */
export function resolveChromeExecutable() {
  const explicit = process.env.SPECTOR_CHROME;
  if (explicit) return explicit;

  const localAppData = process.env.LOCALAPPDATA;
  const root = localAppData ? join(localAppData, 'ms-playwright') : null;
  if (root && existsSync(root)) {
    const builds = readdirSync(root)
      .filter((name) => name.startsWith('chromium-'))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));

    for (const build of builds) {
      const candidate = join(root, build, 'chrome-win64', 'chrome.exe');
      if (existsSync(candidate)) return candidate;
    }
  }

  return null;
}

/** Args that keep WebGL 2 alive in headless Chromium. */
const COLD_START_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

export async function launchBrowser({ width = 1600, height = 1000 } = {}) {
  const executablePath = resolveChromeExecutable();
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: process.env.SPECTOR_HEADFUL !== '1',
    args: COLD_START_ARGS,
  });

  const page = await browser.newPage({
    viewport: { width, height },
    // The editor ships en and pt-BR; pin the language so the run is repeatable.
    locale: 'en-US',
  });

  return { browser, page };
}
