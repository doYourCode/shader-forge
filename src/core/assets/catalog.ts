/**
 * A read-only projection over one authored asset list.
 *
 * Catalogs are deliberately data-only: asset modules author records and the
 * factory adds the lookups every consumer would otherwise re-implement. Keeping
 * that lookup logic here means a new catalog cannot drift from the others.
 */
export interface Catalog<T extends { readonly id: string }> {
  readonly all: readonly T[];
  /** Declared defaults keyed by their role, e.g. `{ model: monkeyEntry }`. */
  readonly defaults: Readonly<Record<string, T>>;
  /** First declared default; `undefined` when the catalog declares none. */
  readonly default: T | undefined;
  find(id: string): T | undefined;
  by(predicate: (entry: T) => boolean): readonly T[];
  has(id: string): boolean;
}

/**
 * A catalog that promises a default, used where a selection must exist.
 *
 * `createCatalog` stays total because not every catalog needs a default (the
 * texture picker has none). The asset modules that do need one narrow the type
 * here, once, instead of forcing every call site to prove `default` is set.
 */
export interface DefaultedCatalog<
  T extends { readonly id: string },
> extends Catalog<T> {
  readonly default: T;
}

/**
 * Creates a frozen catalog over `entries`.
 *
 * Declared defaults refer to entries by id, never by position: reordering the
 * authored list must not silently change which asset a viewer opens with.
 * Invalid catalogs fail during development at module load, which is the
 * earliest point a missing file or a stale id can surface.
 */
export function createCatalog<T extends { readonly id: string }>(
  name: string,
  entries: readonly T[],
  defaults: Readonly<Record<string, string>> = {},
): Catalog<T> {
  const all = Object.freeze([...entries]);
  const byId = new Map<string, T>();

  for (const entry of all) {
    if (import.meta.env.DEV) {
      if (entry.id.trim().length === 0) {
        throw new Error(`Catalog "${name}" contains an empty id.`);
      }
      if (byId.has(entry.id)) {
        throw new Error(
          `Catalog "${name}" contains duplicate id "${entry.id}".`,
        );
      }
    }

    byId.set(entry.id, entry);
  }

  const resolvedDefaults: Record<string, T> = {};
  let firstDefault: T | undefined;

  for (const [role, id] of Object.entries(defaults)) {
    const entry = byId.get(id);
    if (!entry) {
      if (import.meta.env.DEV) {
        throw new Error(
          `Catalog "${name}" declares default "${role}" -> "${id}" but no ` +
            `entry has that id.`,
        );
      }
      continue;
    }

    resolvedDefaults[role] = entry;
    firstDefault ??= entry;
  }

  return Object.freeze({
    all,
    defaults: Object.freeze(resolvedDefaults),
    default: firstDefault,
    find: (id: string): T | undefined => byId.get(id),
    by: (predicate: (entry: T) => boolean): readonly T[] =>
      Object.freeze(all.filter(predicate)),
    has: (id: string): boolean => byId.has(id),
  });
}

/**
 * Narrows a catalog to one with a guaranteed default.
 *
 * The asset module calls this once at module load; a catalog that forgets to
 * declare a default fails immediately with its own name in the message.
 */
export function withDefault<T extends { readonly id: string }>(
  name: string,
  catalog: Catalog<T>,
): DefaultedCatalog<T> {
  const entry = catalog.default;
  if (!entry) {
    throw new Error(`Catalog "${name}" declares no default entry.`);
  }

  return Object.freeze({ ...catalog, default: entry });
}
