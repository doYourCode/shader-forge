import { describe, expect, it, vi } from 'vitest';

import { LoadProfiler, noopLoadTimer } from './LoadProfiler';

function createProfiler() {
  let clock = 0;
  const profiler = new LoadProfiler({ now: () => clock });
  return {
    profiler,
    advance(ms: number) {
      clock += ms;
    },
  };
}

describe('LoadProfiler', () => {
  it('records the wall-clock duration of a phase', () => {
    const { profiler, advance } = createProfiler();

    const stop = profiler.begin('env:load');
    advance(120);
    stop();

    expect(profiler.samples).toEqual([{ phase: 'env:load', ms: 120 }]);
  });

  it('times overlapping phases independently', () => {
    const { profiler, advance } = createProfiler();

    const stopA = profiler.begin('env:load');
    advance(10);
    const stopB = profiler.begin('env:load');
    advance(5);
    stopB();
    advance(5);
    stopA();

    expect(profiler.total('env:load')).toBe(25);
    expect(profiler.samples.map((sample) => sample.ms)).toEqual([5, 20]);
  });

  it('ignores a second stop for the same phase instance', () => {
    const { profiler, advance } = createProfiler();

    const stop = profiler.begin('mesh:load');
    advance(40);
    stop();
    advance(40);
    stop();

    expect(profiler.samples).toHaveLength(1);
  });

  it('times async tasks and records failed ones too', async () => {
    const { profiler, advance } = createProfiler();

    const result = await profiler.measure('shader:compile', async () => {
      advance(30);
      return 'ok';
    });
    await expect(
      profiler.measure('shader:compile', async () => {
        advance(70);
        throw new Error('compile failed');
      }),
    ).rejects.toThrow('compile failed');

    expect(result).toBe('ok');
    expect(profiler.total('shader:compile')).toBe(100);
  });

  it('reports phases in completion order and resets', () => {
    const { profiler, advance } = createProfiler();

    const stopA = profiler.begin('env:load');
    const stopB = profiler.begin('mesh:load');
    advance(5);
    stopB();
    advance(5);
    stopA();

    expect(profiler.report()).toBe(
      [
        `${'mesh:load'.padEnd(18)} 5.0 ms`,
        `${'env:load'.padEnd(18)} 10.0 ms`,
      ].join('\n'),
    );

    profiler.reset();
    expect(profiler.samples).toHaveLength(0);
    expect(profiler.report()).toBe('no load phases recorded');
  });

  it('notifies a listener for every finished phase', () => {
    const onSample = vi.fn();
    let clock = 0;
    const profiler = new LoadProfiler({
      now: () => clock,
      onSample,
    });

    clock = 7;
    const stop = profiler.begin('mesh:load');
    clock = 9;
    stop();

    expect(onSample).toHaveBeenCalledWith({ phase: 'mesh:load', ms: 2 });
  });

  it('runs tasks without bookkeeping when disabled', async () => {
    const result = await noopLoadTimer.measure('anything', async () => 42);
    expect(result).toBe(42);
    expect(noopLoadTimer.begin('anything')).toBeTypeOf('function');
  });
});
