import { describe, expect, it } from 'vitest';
import { AdaptiveResolution } from './adaptiveResolution';

const VSYNC_60 = 1000 / 60;

/** Feeds frames whose duration depends on the current scale; returns how many times the scale changed. */
function run(ar: AdaptiveResolution, frameAt: (scale: number) => number, seconds: number): number {
  let changes = 0;
  for (let t = 0; t < seconds * 1000; ) {
    const ms = frameAt(ar.scale);
    if (ar.addFrame(ms)) changes++;
    t += ms;
  }
  return changes;
}

/** A GPU-bound device: frame time follows the pixel count, but never beats the display refresh. */
const gpuBound = (msAtFullScale: number, refreshMs = VSYNC_60) => (scale: number) => Math.max(refreshMs, msAtFullScale * scale * scale);

describe('AdaptiveResolution', () => {
  it('lowers the scale when a GPU-bound frame is slow', () => {
    const ar = new AdaptiveResolution({ targetMs: 1000 / 58 });
    expect(run(ar, gpuBound(30), 6)).toBeGreaterThan(0);
    expect(ar.scale).toBeLessThan(0.85);
  });

  it('never goes below the minimum', () => {
    const ar = new AdaptiveResolution({ targetMs: 1000 / 58, min: 0.5 });
    run(ar, gpuBound(200), 60);
    expect(ar.scale).toBeCloseTo(0.5);
  });

  it('recovers on a 60 Hz display, where frames never beat 16.7 ms', () => {
    const ar = new AdaptiveResolution({ targetMs: 1000 / 58 });
    run(ar, gpuBound(30), 6);
    expect(ar.scale).toBeLessThan(0.85);
    run(ar, gpuBound(12), 60);
    expect(ar.scale).toBeCloseTo(1);
  });

  it('recovers on a high-refresh display', () => {
    const ar = new AdaptiveResolution({ targetMs: 1000 / 58 });
    run(ar, gpuBound(30, 8), 6);
    run(ar, () => 8, 60);
    expect(ar.scale).toBeCloseTo(1);
  });

  it('keeps full resolution almost all the time when the display caps the frame rate at 30 Hz', () => {
    const ar = new AdaptiveResolution({ targetMs: 1000 / 58 });
    const frameMs = 1000 / 30;
    let atFull = 0;
    let total = 0;
    while (total < 120_000) {
      ar.addFrame(frameMs);
      total += frameMs;
      if (ar.scale === 1) atFull += frameMs;
    }
    expect(atFull / total).toBeGreaterThan(0.9);
    expect(ar.scale).toBe(1);
  });

  it('can still lower the scale after an early 30 Hz phase', () => {
    const ar = new AdaptiveResolution({ targetMs: 1000 / 58, min: 0.6 });
    run(ar, () => 1000 / 30, 20);
    run(ar, gpuBound(28), 120);
    expect(ar.scale).toBeLessThan(0.95);
  });

  it('finds a scale that reaches 60 Hz when frames snap to whole vblanks', () => {
    const ar = new AdaptiveResolution({ targetMs: 1000 / 58, min: 0.6 });
    const vblank = (scale: number) => Math.ceil((25 * scale * scale) / VSYNC_60 - 1e-6) * VSYNC_60;
    run(ar, vblank, 120);
    expect(vblank(ar.scale)).toBeCloseTo(VSYNC_60);
  });

  it('waits longer after each raise that had to be undone, so a borderline device settles', () => {
    const ar = new AdaptiveResolution({ targetMs: 1000 / 58 });
    // A device that is too slow at full resolution and fine just below it.
    const frameAt = (scale: number) => (scale > 0.99 ? 24 : VSYNC_60);
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
    const ar = new AdaptiveResolution({ targetMs: VSYNC_60 });
    expect(run(ar, () => VSYNC_60, 10)).toBe(0);
  });

  it('ignores hitches such as a background tab', () => {
    const ar = new AdaptiveResolution({ targetMs: VSYNC_60, windowMs: 1000 });
    expect(ar.addFrame(5000)).toBe(false);
    expect(ar.scale).toBe(1);
    expect(run(ar, () => VSYNC_60, 3)).toBe(0);
  });
});
