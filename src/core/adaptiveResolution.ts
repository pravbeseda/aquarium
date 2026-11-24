export interface AdaptiveResolutionOptions {
  targetMs: number;
  min?: number;
  max?: number;
  windowMs?: number;
}

const GOOD_WINDOWS_TO_RAISE = 3;
const MAX_GOOD_WINDOWS_TO_RAISE = 30;
/** A drop this many windows after a raise means the raise overshot. */
const OVERSHOOT_WINDOWS = 2;

/**
 * Trades render resolution for frame rate. It drops quickly when frames are slow and climbs back
 * after a few windows at the display's refresh rate; a climb that has to be undone makes the next
 * one wait twice as long, so a device on the edge settles instead of pulsing.
 */
export class AdaptiveResolution {
  scale: number;
  private readonly target: number;
  private readonly min: number;
  private readonly max: number;
  private readonly windowMs: number;
  private elapsed = 0;
  private frames = 0;
  private goodWindows = 0;
  private goodWindowsToRaise = GOOD_WINDOWS_TO_RAISE;
  private windowsSinceRaise = Infinity;

  constructor({ targetMs, min = 0.5, max = 1, windowMs = 2000 }: AdaptiveResolutionOptions) {
    this.target = targetMs;
    this.min = min;
    this.max = max;
    this.windowMs = windowMs;
    this.scale = max;
  }

  /** Records one frame; returns true when the scale changed. */
  addFrame(frameMs: number): boolean {
    if (frameMs > 250) return false; // tab switch or a loading hitch, not a performance signal
    this.elapsed += frameMs;
    this.frames++;
    if (this.elapsed < this.windowMs) return false;

    const avg = this.elapsed / this.frames;
    this.elapsed = 0;
    this.frames = 0;
    this.windowsSinceRaise++;

    if (avg > this.target * 1.2) {
      if (this.windowsSinceRaise <= OVERSHOOT_WINDOWS) {
        this.goodWindowsToRaise = Math.min(MAX_GOOD_WINDOWS_TO_RAISE, this.goodWindowsToRaise * 2);
      }
      this.goodWindows = 0;
      return this.setScale(Math.max(this.min, this.scale * 0.85));
    }

    // Within a few percent of the target is as fast as a vsync-capped display gets.
    if (avg > this.target * 1.08 || this.scale >= this.max) {
      this.goodWindows = 0;
      return false;
    }
    if (++this.goodWindows < this.goodWindowsToRaise) return false;
    this.goodWindows = 0;
    this.windowsSinceRaise = 0;
    return this.setScale(Math.min(this.max, this.scale * 1.08));
  }

  private setScale(scale: number): boolean {
    const changed = scale !== this.scale;
    this.scale = scale;
    return changed;
  }
}
