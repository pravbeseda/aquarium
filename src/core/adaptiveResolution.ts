export interface AdaptiveResolutionOptions {
  targetMs: number;
  min?: number;
  max?: number;
  windowMs?: number;
}

/** Trades render resolution for frame rate, with hysteresis so it does not oscillate. */
export class AdaptiveResolution {
  scale: number;
  private readonly target: number;
  private readonly min: number;
  private readonly max: number;
  private readonly windowMs: number;
  private elapsed = 0;
  private frames = 0;

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

    const previous = this.scale;
    if (avg > this.target * 1.2) this.scale = Math.max(this.min, this.scale * 0.85);
    else if (avg < this.target * 0.8) this.scale = Math.min(this.max, this.scale * 1.08);
    return this.scale !== previous;
  }
}
