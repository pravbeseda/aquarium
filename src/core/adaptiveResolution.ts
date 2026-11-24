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
const DROP_BLOCK_WINDOWS = 5;
const MAX_DROP_BLOCK_WINDOWS = 60;

/**
 * Trades render resolution for frame rate. It drops quickly when frames are slow and climbs back
 * after a few windows at the display's refresh rate; a climb that has to be undone makes the next
 * one wait twice as long, so a device on the edge settles instead of pulsing. A drop that does not
 * speed frames up is undone and the next try waits twice as long, so a 30 Hz cap or a CPU-bound
 * device keeps its full resolution almost all the time without ruling resolution out for good.
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
  /** The window before the last drop, kept until the next window shows whether the drop helped. */
  private lastDrop: { avg: number; scale: number } | null = null;
  private dropBlock = 0;
  private dropBlockWindows = DROP_BLOCK_WINDOWS;

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
    if (this.dropBlock > 0) this.dropBlock--;

    const drop = this.lastDrop;
    this.lastDrop = null;
    if (drop && avg > drop.avg * 0.93) {
      // Fewer pixels did not help (a 30 Hz cap, a CPU-bound frame): undo it and wait longer before trying again.
      this.dropBlock = this.dropBlockWindows;
      this.dropBlockWindows = Math.min(MAX_DROP_BLOCK_WINDOWS, this.dropBlockWindows * 2);
      return this.setScale(drop.scale);
    }

    if (avg > this.target * 1.2) {
      if (this.dropBlock > 0 || this.scale <= this.min) return false;
      if (this.windowsSinceRaise <= OVERSHOOT_WINDOWS) {
        this.goodWindowsToRaise = Math.min(MAX_GOOD_WINDOWS_TO_RAISE, this.goodWindowsToRaise * 2);
      }
      this.goodWindows = 0;
      this.lastDrop = { avg, scale: this.scale };
      // Frame time follows the pixel count (scale squared), so aim straight at the target, within limits.
      const factor = Math.min(0.9, Math.max(0.7, Math.sqrt(this.target / avg)));
      return this.setScale(Math.max(this.min, this.scale * factor));
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
