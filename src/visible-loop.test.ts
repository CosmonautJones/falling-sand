import { describe, expect, it, vi } from 'vitest';
import { startVisibleLoop } from './visible-loop';

function harness(hidden = false) {
  const page = new EventTarget() as EventTarget & { hidden: boolean };
  page.hidden = hidden;
  let nextId = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const clock = {
    request: (callback: FrameRequestCallback) => {
      pending.set(++nextId, callback);
      return nextId;
    },
    cancel: (id: number) => {
      pending.delete(id);
    },
  };
  const frame = vi.fn();
  const resume = vi.fn();
  const suspend = vi.fn();
  const stop = startVisibleLoop({ frame, resume, suspend }, page, clock);
  const visible = (value: boolean) => {
    page.hidden = !value;
    page.dispatchEvent(new Event('visibilitychange'));
  };
  const tick = (now: number) => {
    const entry = pending.entries().next().value!;
    pending.delete(entry[0]);
    entry[1](now);
  };
  return { pending, frame, resume, suspend, stop, visible, tick };
}

describe('visible animation loop', () => {
  it('does no work when opened in a background tab', () => {
    const h = harness(true);
    expect(h.pending.size).toBe(0);
    expect(h.frame).not.toHaveBeenCalled();
    h.visible(true);
    expect(h.pending.size).toBe(1);
    expect(h.resume).toHaveBeenCalledOnce();
    h.tick(10000);
    expect(h.frame).toHaveBeenCalledWith(10000);
  });

  it('cancels hidden work and resumes exactly one fresh loop', () => {
    const h = harness();
    const stale = [...h.pending.values()][0];
    h.visible(false);
    expect(h.pending.size).toBe(0);
    expect(h.suspend).toHaveBeenCalledOnce();
    stale(1000);
    expect(h.frame).not.toHaveBeenCalled();
    h.visible(true);
    h.visible(true);
    expect(h.pending.size).toBe(1);
    expect(h.resume).toHaveBeenCalledTimes(2);
    h.tick(20000);
    expect(h.frame).toHaveBeenCalledOnce();
    expect(h.pending.size).toBe(1);
  });

  it('rejects an old callback after returning and removes listeners on stop', () => {
    const h = harness();
    const stale = [...h.pending.values()][0];
    h.visible(false);
    h.visible(true);
    stale(20000);
    expect(h.frame).not.toHaveBeenCalled();
    expect(h.pending.size).toBe(1);
    h.stop();
    expect(h.pending.size).toBe(0);
    h.visible(false);
    h.visible(true);
    expect(h.pending.size).toBe(0);
  });
});
