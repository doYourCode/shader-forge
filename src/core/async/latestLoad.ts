/**
 * Latest-wins bookkeeping for asynchronous loads.
 *
 * The pattern repeats wherever a slow resource can be replaced before it
 * arrives: a texture, an environment, a model. A newer request must retire the
 * previous one, exactly one promise per request must settle, and the payload
 * the caller associated with a retired request must be released exactly once.
 * The primitive owns request identity and settle-once; the caller owns the
 * payload and releases it through the single `retire` hook.
 *
 * It is deliberately not an abstraction over loading itself: how a texture or
 * environment is created, filtered or applied stays in its service.
 */

/** A promise whose result can be published exactly once. */
interface PendingResult<T> {
  readonly promise: Promise<T>;
  settled: boolean;
  settle(value: T): void;
}

function createPendingResult<T>(): PendingResult<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });

  const result: PendingResult<T> = {
    promise,
    settled: false,
    settle(value) {
      if (result.settled) return;
      result.settled = true;
      resolve(value);
    },
  };

  return result;
}

/** The handle kept for one request started by a latest-wins slot. */
export interface PendingLoad<TResult, TPayload> {
  readonly promise: Promise<TResult>;
  readonly payload: TPayload;
  /** True while no newer request has superseded this one. */
  isCurrent(): boolean;
  /**
   * Settles the request exactly once. Returns whether it was still current;
   * a retired request is not settled again.
   */
  settle(value: TResult): boolean;
}

interface LoadState<TResult, TPayload> {
  readonly payload: TPayload;
  readonly result: PendingResult<TResult>;
  readonly retire: (payload: TPayload) => void;
}

function toHandle<TResult, TPayload>(
  entry: LoadState<TResult, TPayload>,
  clear: () => void,
): PendingLoad<TResult, TPayload> {
  return {
    promise: entry.result.promise,
    payload: entry.payload,
    isCurrent: () => !entry.result.settled,
    settle: (value) => {
      if (entry.result.settled) return false;

      clear();
      // On success the caller transfers ownership to its live state by
      // clearing the payload first, so retiring here releases only leftovers.
      entry.retire(entry.payload);
      entry.result.settle(value);
      return true;
    },
  };
}

/**
 * A single slot. Starting a request retires the previous one: its promise
 * resolves with `superseded` and its `retire` hook runs once.
 */
export class LatestLoad<TResult, TPayload> {
  private entry: LoadState<TResult, TPayload> | null = null;
  private readonly superseded: TResult;

  constructor(superseded: TResult) {
    this.superseded = superseded;
  }

  begin(
    payload: TPayload,
    retire: (payload: TPayload) => void,
  ): PendingLoad<TResult, TPayload> {
    this.cancel();

    const entry: LoadState<TResult, TPayload> = {
      payload,
      result: createPendingResult<TResult>(),
      retire,
    };
    this.entry = entry;

    return toHandle(entry, () => {
      if (this.entry === entry) this.entry = null;
    });
  }

  /** The request currently in flight, if any. */
  get(): PendingLoad<TResult, TPayload> | null {
    const entry = this.entry;
    if (!entry) return null;

    return toHandle(entry, () => {
      if (this.entry === entry) this.entry = null;
    });
  }

  /** Retires the active request, resolving it with the superseded value. */
  cancel(): void {
    const entry = this.entry;
    if (!entry) return;

    this.entry = null;
    entry.retire(entry.payload);
    entry.result.settle(this.superseded);
  }

  /** Cancels the active request; the slot stays usable for a later begin. */
  dispose(): void {
    this.cancel();
  }
}

/**
 * One slot per key, so independent definitions (textures) supersede only
 * their own previous request.
 */
export class KeyedLatestLoads<TKey, TResult, TPayload> {
  private readonly slots = new Map<TKey, LatestLoad<TResult, TPayload>>();
  private readonly superseded: TResult;

  constructor(superseded: TResult) {
    this.superseded = superseded;
  }

  begin(
    key: TKey,
    payload: TPayload,
    retire: (payload: TPayload) => void,
  ): PendingLoad<TResult, TPayload> {
    let slot = this.slots.get(key);
    if (!slot) {
      slot = new LatestLoad<TResult, TPayload>(this.superseded);
      this.slots.set(key, slot);
    }

    return slot.begin(payload, retire);
  }

  get(key: TKey): PendingLoad<TResult, TPayload> | null {
    return this.slots.get(key)?.get() ?? null;
  }

  cancel(key: TKey): void {
    this.slots.get(key)?.cancel();
  }

  dispose(): void {
    for (const slot of this.slots.values()) slot.dispose();
    this.slots.clear();
  }
}
