import { describe, expect, it, vi } from 'vitest';

import { KeyedLatestLoads, LatestLoad } from './latestLoad';

interface Payload {
  readonly id: string;
}

describe('LatestLoad', () => {
  it('settles the active request once and retires its payload', async () => {
    const slot = new LatestLoad<string, Payload>('superseded');
    const retire = vi.fn();
    const load = slot.begin({ id: 'a' }, retire);

    expect(load.isCurrent()).toBe(true);
    expect(slot.get()?.payload.id).toBe('a');

    expect(load.settle('done')).toBe(true);
    expect(load.isCurrent()).toBe(false);
    expect(slot.get()).toBeNull();

    await expect(load.promise).resolves.toBe('done');
    expect(retire).toHaveBeenCalledTimes(1);
    expect(retire).toHaveBeenCalledWith({ id: 'a' });

    // A late callback cannot publish a second result or release twice.
    expect(load.settle('late')).toBe(false);
    expect(retire).toHaveBeenCalledTimes(1);
  });

  it('supersedes the previous request with the configured value', async () => {
    const slot = new LatestLoad<boolean, Payload>(false);
    const retireFirst = vi.fn();
    const retireSecond = vi.fn();

    const first = slot.begin({ id: 'first' }, retireFirst);
    const second = slot.begin({ id: 'second' }, retireSecond);

    await expect(first.promise).resolves.toBe(false);
    expect(first.isCurrent()).toBe(false);
    expect(retireFirst).toHaveBeenCalledTimes(1);
    expect(retireSecond).not.toHaveBeenCalled();

    expect(second.isCurrent()).toBe(true);
    expect(slot.get()?.payload.id).toBe('second');

    expect(second.settle(true)).toBe(true);
    await expect(second.promise).resolves.toBe(true);
    expect(retireSecond).toHaveBeenCalledTimes(1);
  });

  it('cancels the active request without breaking the slot', async () => {
    const slot = new LatestLoad<string, Payload>('cancelled');
    const retire = vi.fn();
    const load = slot.begin({ id: 'a' }, retire);

    slot.cancel();

    await expect(load.promise).resolves.toBe('cancelled');
    expect(load.settle('late')).toBe(false);
    expect(retire).toHaveBeenCalledTimes(1);
    expect(slot.get()).toBeNull();

    const next = slot.begin({ id: 'b' }, vi.fn());
    expect(next.isCurrent()).toBe(true);
    expect(slot.get()?.payload.id).toBe('b');
  });

  it('disposes the active request', async () => {
    const slot = new LatestLoad<boolean, Payload>(false);
    const retire = vi.fn();
    const load = slot.begin({ id: 'a' }, retire);

    slot.dispose();

    await expect(load.promise).resolves.toBe(false);
    expect(retire).toHaveBeenCalledTimes(1);
  });
});

describe('KeyedLatestLoads', () => {
  it('keeps independent slots per key', () => {
    const slots = new KeyedLatestLoads<string, boolean, Payload>(false);
    const first = slots.begin('a', { id: 'a1' }, vi.fn());
    const second = slots.begin('b', { id: 'b1' }, vi.fn());

    expect(slots.get('a')?.payload.id).toBe('a1');
    expect(slots.get('b')?.payload.id).toBe('b1');
    expect(first.isCurrent()).toBe(true);
    expect(second.isCurrent()).toBe(true);
  });

  it('supersedes only the same key', async () => {
    const slots = new KeyedLatestLoads<string, boolean, Payload>(false);
    const retireA = vi.fn();
    const retireB = vi.fn();
    const firstA = slots.begin('a', { id: 'a1' }, retireA);
    const b = slots.begin('b', { id: 'b1' }, retireB);

    const secondA = slots.begin('a', { id: 'a2' }, vi.fn());

    await expect(firstA.promise).resolves.toBe(false);
    expect(retireA).toHaveBeenCalledTimes(1);
    expect(retireB).not.toHaveBeenCalled();
    expect(b.isCurrent()).toBe(true);
    expect(secondA.isCurrent()).toBe(true);
    expect(slots.get('b')?.payload.id).toBe('b1');
  });

  it('cancels and disposes without touching other keys', async () => {
    const slots = new KeyedLatestLoads<string, boolean, Payload>(false);
    const retireA = vi.fn();
    const retireB = vi.fn();
    const a = slots.begin('a', { id: 'a1' }, retireA);
    const b = slots.begin('b', { id: 'b1' }, retireB);

    slots.cancel('a');
    await expect(a.promise).resolves.toBe(false);
    expect(slots.get('a')).toBeNull();
    expect(b.isCurrent()).toBe(true);

    slots.dispose();
    await expect(b.promise).resolves.toBe(false);
    expect(retireA).toHaveBeenCalledTimes(1);
    expect(retireB).toHaveBeenCalledTimes(1);
  });
});
