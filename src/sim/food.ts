import { Vector3 } from 'three';
import type { Rng } from '../core/random';
import { TANK, substrateHeight } from './tank';

/** Floating flakes hang this far below the surface plane, which the water pass recognises by height. */
export const FLAKE_FLOAT_DEPTH = 0.004;

export interface Flake {
  position: Vector3;
  /** Horizontal drift velocity while sinking. */
  drift: Vector3;
  /** Seconds left floating on the surface before it starts sinking. */
  floatTime: number;
  sinkSpeed: number;
  /** Tumble phase, used by the renderer to spin the flake. */
  spin: number;
  spinRate: number;
  landed: boolean;
  /** Seconds since landing. */
  settledAge: number;
  /** Colour variant index for the renderer. */
  variant: number;
}

export interface Eater {
  position: Vector3;
  radius: number;
}

export interface FoodOptions {
  firstFeeding: number;
  interval: [number, number];
  flakesPerFeeding: number;
  settledLifetime?: number;
  maxFlakes?: number;
}

/** Periodic feedings: flakes float, sink with a gentle drift, settle and dissolve unless eaten. */
export class FoodSystem {
  readonly flakes: Flake[] = [];
  private readonly rng: Rng;
  private readonly opts: Required<FoodOptions>;
  private untilFeeding: number;

  constructor(rng: Rng, opts: FoodOptions) {
    this.rng = rng;
    this.opts = { settledLifetime: 25, maxFlakes: 80, ...opts };
    this.untilFeeding = opts.firstFeeding;
  }

  /** Advances the simulation; returns the indices of the eaters that ate a flake this step. */
  update(dt: number, eaters: readonly Eater[]): number[] {
    this.untilFeeding -= dt;
    if (this.untilFeeding <= 0) {
      this.feed();
      const [lo, hi] = this.opts.interval;
      this.untilFeeding = lo + this.rng() * (hi - lo);
    }

    const eaten: number[] = [];
    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const f = this.flakes[i];
      this.move(f, dt);

      const eater = eaters.findIndex((e) => e.position.distanceToSquared(f.position) < e.radius * e.radius);
      if (eater >= 0) {
        eaten.push(eater);
        this.flakes.splice(i, 1);
      } else if (f.landed && f.settledAge > this.opts.settledLifetime) {
        this.flakes.splice(i, 1);
      }
    }
    return eaten;
  }

  private move(f: Flake, dt: number): void {
    if (f.landed) {
      f.settledAge += dt;
      return;
    }
    f.spin += f.spinRate * dt;
    if (f.floatTime > 0) {
      f.floatTime -= dt;
      f.position.addScaledVector(f.drift, dt * 0.3);
    } else {
      f.position.addScaledVector(f.drift, dt);
      // Flat flakes flutter: the sink rate oscillates with the tumble.
      f.position.y -= f.sinkSpeed * (0.75 + 0.25 * Math.sin(f.spin * 2)) * dt;
      f.drift.multiplyScalar(Math.exp(-0.15 * dt));
    }
    f.position.x = Math.min(TANK.max.x - 0.01, Math.max(TANK.min.x + 0.01, f.position.x));
    f.position.z = Math.min(TANK.max.z - 0.01, Math.max(TANK.min.z + 0.01, f.position.z));
    const floor = substrateHeight(f.position.x, f.position.z);
    if (f.position.y <= floor) {
      f.position.y = floor;
      f.landed = true;
    }
  }

  private feed(): void {
    const cx = TANK.min.x + 0.2 + this.rng() * (TANK.max.x - TANK.min.x - 0.4);
    const cz = TANK.min.z + 0.1 + this.rng() * (TANK.max.z - TANK.min.z - 0.2);
    const room = this.opts.maxFlakes - this.flakes.length;
    const n = Math.min(room, this.opts.flakesPerFeeding);
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const r = Math.sqrt(this.rng()) * 0.05;
      this.flakes.push({
        position: new Vector3(cx + Math.cos(a) * r, TANK.waterLevel - FLAKE_FLOAT_DEPTH, cz + Math.sin(a) * r),
        drift: new Vector3((this.rng() - 0.5) * 0.02, 0, (this.rng() - 0.5) * 0.02),
        floatTime: 0.5 + this.rng() * 2.5,
        sinkSpeed: 0.018 + this.rng() * 0.014,
        spin: this.rng() * Math.PI * 2,
        spinRate: 1 + this.rng() * 3,
        landed: false,
        settledAge: 0,
        variant: Math.floor(this.rng() * 3),
      });
    }
  }
}
