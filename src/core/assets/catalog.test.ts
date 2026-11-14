import { describe, expect, it } from 'vitest';

import { createCatalog, withDefault } from './catalog';

interface Entry {
  readonly id: string;
  readonly kind: string;
}

const ENTRIES: readonly Entry[] = [
  { id: 'alpha', kind: 'mesh' },
  { id: 'beta', kind: 'mesh' },
  { id: 'gamma', kind: 'texture' },
];

describe('createCatalog', () => {
  it('exposes the entries and looks them up by id', () => {
    const catalog = createCatalog('test', ENTRIES);

    expect(catalog.all).toEqual(ENTRIES);
    expect(catalog.find('beta')).toEqual(ENTRIES[1]);
    expect(catalog.has('beta')).toBe(true);
    expect(catalog.find('missing')).toBeUndefined();
    expect(catalog.has('missing')).toBe(false);
  });

  it('filters entries with by()', () => {
    const catalog = createCatalog('test', ENTRIES);

    expect(catalog.by((entry) => entry.kind === 'mesh').map((entry) => entry.id))
      .toEqual(['alpha', 'beta']);
  });

  it('resolves declared defaults by id, not by position', () => {
    const catalog = createCatalog('test', ENTRIES, { first: 'gamma' });

    expect(catalog.default).toEqual(ENTRIES[2]);
    expect(catalog.defaults.first).toEqual(ENTRIES[2]);
  });

  it('uses the first declared default and reports none when undeclared', () => {
    const declared = createCatalog('test', ENTRIES, {
      first: 'beta',
      second: 'gamma',
    });
    const undeclared = createCatalog('test', ENTRIES);

    expect(declared.default).toEqual(ENTRIES[1]);
    expect(undeclared.default).toBeUndefined();
    expect(undeclared.defaults).toEqual({});
  });

  it('freezes the entries, the defaults and the catalog itself', () => {
    const catalog = createCatalog('test', ENTRIES, { first: 'alpha' });

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.all)).toBe(true);
    expect(Object.isFrozen(catalog.defaults)).toBe(true);
  });

  it('throws on a duplicate id during development', () => {
    expect(() =>
      createCatalog('test', [{ id: 'same' }, { id: 'same' }]),
    ).toThrow(/duplicate id "same"/);
  });

  it('throws on an empty id during development', () => {
    expect(() => createCatalog('test', [{ id: '  ' }])).toThrow(/empty id/);
  });

  it('throws when a declared default has no matching entry', () => {
    expect(() => createCatalog('test', ENTRIES, { first: 'missing' })).toThrow(
      /default "first" -> "missing"/,
    );
  });
});

describe('withDefault', () => {
  it('narrows the catalog and keeps it frozen', () => {
    const catalog = withDefault(
      'test',
      createCatalog('test', ENTRIES, { first: 'alpha' }),
    );

    expect(catalog.default).toEqual(ENTRIES[0]);
    expect(Object.isFrozen(catalog)).toBe(true);
  });

  it('throws when the catalog declares no default', () => {
    expect(() =>
      withDefault('test', createCatalog('test', ENTRIES)),
    ).toThrow(/declares no default/);
  });
});
