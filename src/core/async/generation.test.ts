import { describe, expect, it } from 'vitest';

import { GenerationTracker } from './generation';

describe('GenerationTracker', () => {
  it('makes the latest generation current and supersedes the previous one', () => {
    const tracker = new GenerationTracker();

    const first = tracker.begin();
    expect(first.isCurrent()).toBe(true);

    const second = tracker.begin();
    expect(first.isCurrent()).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it('captures the live generation without superseding it', () => {
    const tracker = new GenerationTracker();
    tracker.begin();

    const captured = tracker.current();

    expect(captured.isCurrent()).toBe(true);
    expect(tracker.current().isCurrent()).toBe(true);

    tracker.begin();
    expect(captured.isCurrent()).toBe(false);
  });

  it('invalidates every live scope on demand', () => {
    const tracker = new GenerationTracker();
    const captured = tracker.current();
    const begun = tracker.begin();

    tracker.invalidate();

    expect(captured.isCurrent()).toBe(false);
    expect(begun.isCurrent()).toBe(false);
  });

  it('keeps independent trackers independent', () => {
    const sessions = new GenerationTracker();
    const requests = new GenerationTracker();

    const session = sessions.begin();
    const request = requests.begin();

    requests.begin();
    expect(request.isCurrent()).toBe(false);
    expect(session.isCurrent()).toBe(true);

    sessions.invalidate();
    expect(session.isCurrent()).toBe(false);
  });
});
