import { describe, expect, it } from 'vitest';
import { AdaptiveResolution } from './adaptiveResolution';

function feed(ar: AdaptiveResolution, frameMs: number, seconds: number) {
  let changed = false;
  for (let t = 0; t < seconds * 1000; t += frameMs) changed = ar.addFrame(frameMs) || changed;
  return changed;
}

describe('AdaptiveResolution', () => {
  it('lowers the scale when frames are slow', () => {
    const ar = new AdaptiveResolution({ targetMs: 16.7 });
    expect(feed(ar, 30, 2.5)).toBe(true);
    expect(ar.scale).toBeLessThan(1);
  });

  it('never goes below the minimum', () => {
    const ar = new AdaptiveResolution({ targetMs: 16.7, min: 0.5 });
    feed(ar, 100, 60);
    expect(ar.scale).toBeCloseTo(0.5);
  });

  it('recovers when frames are fast again, up to the maximum', () => {
    const ar = new AdaptiveResolution({ targetMs: 16.7 });
    feed(ar, 30, 6);
    feed(ar, 8, 60);
    expect(ar.scale).toBeCloseTo(1);
  });

  it('recovers on a 60 Hz display, where frames never beat 16.7 ms', () => {
    const ar = new AdaptiveResolution({ targetMs: 1000 / 58 });
    feed(ar, 30, 6);
    expect(ar.scale).toBeLessThan(0.75);
    feed(ar, 1000 / 60, 60);
    expect(ar.scale).toBeCloseTo(1);
  });

  it('waits longer after each raise that had to be undone, so a borderline device settles', () => {
    const ar = new AdaptiveResolution({ targetMs: 1000 / 58 });
    // A device that is too slow at full resolution and fine just below it.
    const frameAt = (scale: number) => (scale > 0.99 ? 24 : 1000 / 60);
    const drops: number[] = [];
    let t = 0;
    while (t < 300_000) {
      const before = ar.scale;
      const ms = frameAt(ar.scale);
      ar.addFrame(ms);
      t += ms;
      if (ar.scale < before) drops.push(t);
    }
    expect(drops.length).toBeGreaterThan(2);
    expect(drops.length).toBeLessThan(8);
    const gaps = drops.slice(1).map((d, i) => d - drops[i]);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1]);
    expect(gaps[gaps.length - 1]).toBeGreaterThan(gaps[0] * 2);
  });

  it('holds steady inside the comfort band', () => {
    const ar = new AdaptiveResolution({ targetMs: 16.7 });
    expect(feed(ar, 16.7, 10)).toBe(false);
  });

  it('ignores hitches such as a background tab', () => {
    const ar = new AdaptiveResolution({ targetMs: 16.7, windowMs: 1000 });
    expect(ar.addFrame(5000)).toBe(false);
    expect(ar.scale).toBe(1);
    expect(feed(ar, 16.7, 3)).toBe(false);
  });
});
