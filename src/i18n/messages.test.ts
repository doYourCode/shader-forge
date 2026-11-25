import { describe, expect, it } from 'vitest';

import { i18n } from './index';

const STATS = {
  fps: 60,
  ms: '8.0',
  budget: '16.7',
  width: 1280,
  height: 720,
  drawCalls: 551,
  scale: 75,
} as const;

const LOCALES = ['en', 'pt-BR'] as const;

/**
 * The stats line is the only on-screen performance feedback, and vue-i18n has
 * message-only syntax (linked `@key` messages, plural `|` separators) that a
 * typecheck cannot catch: a stray `@` turns the template into a lookup and the
 * whole line renders empty.
 */
describe.each(LOCALES)('screen-space stats message (%s)', (locale) => {
  it('renders every measured value', () => {
    i18n.global.locale.value = locale;

    const text = i18n.global.t('screenSpace.stats', STATS);

    expect(text).toContain('60 fps');
    expect(text).toContain('8.0 ms / 16.7 ms');
    expect(text).toContain('1280×720');
    expect(text).toContain('(75%)');
    expect(text).toContain('551 draws');
  });
});
