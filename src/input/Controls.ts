import type { SwimIntent } from '../sim/swim';

/** A source of player input: keyboard and mouse, or touch. */
export interface InputSource {
  /** Current movement intent from this source. */
  readonly intent: SwimIntent;
  /** Look rotation accumulated since the last call, in radians (yaw, pitch). */
  takeLook(): [number, number];
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export function idleIntent(): SwimIntent {
  return { forward: 0, strafe: 0, rise: 0, boost: false };
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** Merges several input sources into one intent and one look delta. */
export class Controls {
  private readonly sources: InputSource[];
  private readonly merged: SwimIntent = idleIntent();

  constructor(sources: InputSource[]) {
    this.sources = sources;
  }

  intent(): SwimIntent {
    const m = this.merged;
    m.forward = clamp1(this.sources.reduce((s, src) => s + src.intent.forward, 0));
    m.strafe = clamp1(this.sources.reduce((s, src) => s + src.intent.strafe, 0));
    m.rise = clamp1(this.sources.reduce((s, src) => s + src.intent.rise, 0));
    m.boost = this.sources.some((src) => src.intent.boost);
    return m;
  }

  takeLook(): [number, number] {
    let yaw = 0;
    let pitch = 0;
    for (const s of this.sources) {
      const [y, p] = s.takeLook();
      yaw += y;
      pitch += p;
    }
    return [yaw, pitch];
  }

  setEnabled(enabled: boolean): void {
    for (const s of this.sources) s.setEnabled(enabled);
  }

  dispose(): void {
    for (const s of this.sources) s.dispose();
  }
}
