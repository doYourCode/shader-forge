/**
 * Generation bookkeeping for async work that can be superseded.
 *
 * A generation is a cheap identity token: work captures one before awaiting and
 * checks it afterwards. `begin()` starts a new generation and supersedes all
 * older ones, `current()` captures the live one for work that must survive only
 * while its session does, and `invalidate()` retires everything (dispose).
 *
 * The tracker is deliberately generic: it never knows what the generation
 * guards, so the same helper covers an init session and a model swap.
 */

/** A handle for one generation of asynchronous work. */
export interface GenerationScope {
  isCurrent(): boolean;
}

export class GenerationTracker {
  private generation = 0;

  /** Starts a new generation, superseding every older scope. */
  begin(): GenerationScope {
    this.generation += 1;
    return this.scopeFor(this.generation);
  }

  /** Captures the live generation without superseding it. */
  current(): GenerationScope {
    return this.scopeFor(this.generation);
  }

  /** Supersedes every live scope, for example when the owner is disposed. */
  invalidate(): void {
    this.generation += 1;
  }

  private scopeFor(generation: number): GenerationScope {
    return { isCurrent: () => generation === this.generation };
  }
}
