/**
 * Wall-clock instrumentation for the preview's load phases.
 *
 * The preview loads asynchronously across several collaborators (texture
 * factory, mesh provider, GPU filters, shader compile). Rather than scattering
 * `performance.now()` calls through them, they receive this narrow port and
 * report named phases. The profiler only records; deciding what to do with the
 * samples (console table, `?perf` overlay, benchmark harness) stays outside.
 */
export interface LoadPhaseSample {
  /** Stable, kebab/colon separated phase name, e.g. `env:filter`. */
  readonly phase: string;
  /** Wall-clock duration in milliseconds. */
  readonly ms: number;
}

/** Port injected into the loading collaborators. */
export interface LoadTimer {
  /** Starts a phase and returns the function that ends it. */
  begin(phase: string): () => void;
  /** Times an async task for its whole lifetime. */
  measure<T>(phase: string, task: () => Promise<T>): Promise<T>;
}

/** The default collaborator: keeps production free of bookkeeping. */
export const noopLoadTimer: LoadTimer = {
  begin: () => () => {},
  measure: (_phase, task) => task(),
};

export interface LoadProfilerOptions {
  /** Clock, injectable so tests do not depend on real time. */
  readonly now?: () => number;
  /** Called for every finished phase (useful for live overlays). */
  readonly onSample?: (sample: LoadPhaseSample) => void;
}

/**
 * Records finished phases in completion order.
 *
 * A phase may be started twice (for example two environment loads in a row);
 * each `begin` returns its own stop function, so overlapping loads are timed
 * independently instead of overwriting a shared entry.
 */
export class LoadProfiler implements LoadTimer {
  private readonly now: () => number;
  private readonly onSample: ((sample: LoadPhaseSample) => void) | null;
  private readonly finished: LoadPhaseSample[] = [];

  constructor(options: LoadProfilerOptions = {}) {
    this.now = options.now ?? (() => performance.now());
    this.onSample = options.onSample ?? null;
  }

  begin(phase: string): () => void {
    const startedAt = this.now();
    let stopped = false;

    return () => {
      if (stopped) return;
      stopped = true;
      this.push(phase, this.now() - startedAt);
    };
  }

  async measure<T>(phase: string, task: () => Promise<T>): Promise<T> {
    const stop = this.begin(phase);
    try {
      return await task();
    } finally {
      stop();
    }
  }

  /** Finished phases, oldest first. */
  get samples(): readonly LoadPhaseSample[] {
    return this.finished;
  }

  /** Total time attributed to the named phase (0 when it never ran). */
  total(phase: string): number {
    return this.finished
      .filter((sample) => sample.phase === phase)
      .reduce((sum, sample) => sum + sample.ms, 0);
  }

  reset(): void {
    this.finished.length = 0;
  }

  /** Human-readable summary, one line per phase, in completion order. */
  report(): string {
    if (this.finished.length === 0) return 'no load phases recorded';

    return this.finished
      .map((sample) => `${sample.phase.padEnd(18)} ${sample.ms.toFixed(1)} ms`)
      .join('\n');
  }

  private push(phase: string, ms: number): void {
    const sample: LoadPhaseSample = { phase, ms };
    this.finished.push(sample);
    this.onSample?.(sample);
  }
}

/**
 * Publishes the profiler on `window` so it can be inspected from the console
 * (`window.__shaderForgePerf.report()`), and used by the benchmark harness.
 */
export interface PerfGlobal {
  report(): string;
  samples(): readonly LoadPhaseSample[];
}

export function exposeProfiler(
  profiler: LoadProfiler,
  target: Window & typeof globalThis = window,
): void {
  const global = target as typeof target & {
    __shaderForgePerf?: PerfGlobal;
  };
  global.__shaderForgePerf = {
    report: () => profiler.report(),
    samples: () => profiler.samples,
  };
}
