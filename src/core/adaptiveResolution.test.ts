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

  it('holds steady inside the comfort band', () => {
    const ar = new AdaptiveResolution({ targetMs: 16.7 });
    expect(feed(ar, 16.7, 10)).toBe(false);
  });

  it('ignores hitches such as a background tab', () => {
    const ar = new AdaptiveResolution({ targetMs: 16.7 });
    ar.addFrame(5000);
    expect(feed(ar, 16.7, 3)).toBe(false);
  });
});
