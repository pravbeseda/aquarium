import { Vector3 } from 'three';
import type { Rng } from '../core/random';
import { TANK, substrateHeight, type TankCollider } from './tank';

export interface WanderContext {
  collider: TankCollider;
  threat?: Vector3;
}

const tmp = new Vector3();
const steer = new Vector3();

/** A calm, larger fish: glides between random waypoints in open water and shies away from the player. */
export class Wanderer {
  readonly position: Vector3;
  readonly velocity = new Vector3();
  readonly target = new Vector3();
  private readonly rng: Rng;
  private readonly cruise: number;
  private readonly bodyRadius = 0.03;
  private timer = 0;

  constructor(rng: Rng, start: Vector3, cruiseSpeed: number) {
    this.rng = rng;
    this.position = start.clone();
    this.cruise = cruiseSpeed;
    this.velocity.set(cruiseSpeed, 0, 0);
    this.pickTarget();
  }

  step(dt: number, ctx: WanderContext): void {
    this.timer -= dt;
    if (this.timer <= 0 || this.position.distanceTo(this.target) < 0.05) this.pickTarget();

    let speed = this.cruise;
    steer.subVectors(this.target, this.position).setLength(speed).sub(this.velocity).multiplyScalar(0.8);

    if (ctx.threat) {
      tmp.subVectors(this.position, ctx.threat);
      const d = tmp.length();
      if (d < 0.16 && d > 1e-6) {
        steer.addScaledVector(tmp.divideScalar(d), (1 - d / 0.16) * 1.2);
        speed = this.cruise * 3;
      }
    }

    for (const o of ctx.collider.obstacles) {
      tmp.subVectors(this.position, o.center);
      const d = tmp.length();
      const reach = o.radius + 0.09;
      if (d < reach && d > 1e-6) steer.addScaledVector(tmp.divideScalar(d), (1 - (d - o.radius) / 0.09) * 0.5);
    }

    this.velocity.addScaledVector(steer, dt);
    this.velocity.y *= Math.exp(-2 * dt);
    const v = this.velocity.length();
    if (v > speed) this.velocity.multiplyScalar(speed / v);
    else if (v < this.cruise * 0.3) this.velocity.setLength(this.cruise * 0.3);

    this.position.addScaledVector(this.velocity, dt);
    const normal = ctx.collider.resolve(this.position, this.bodyRadius);
    if (normal) {
      const into = this.velocity.dot(normal);
      if (into < 0) this.velocity.addScaledVector(normal, -into * 1.5);
      this.pickTarget();
    }
  }

  private pickTarget(): void {
    this.timer = 5 + this.rng() * 7;
    const x = TANK.min.x + 0.12 + this.rng() * (TANK.max.x - TANK.min.x - 0.24);
    const z = TANK.min.z + 0.08 + this.rng() * (TANK.max.z - TANK.min.z - 0.16);
    const floor = substrateHeight(x, z);
    const y = floor + 0.1 + this.rng() * (TANK.waterLevel - floor - 0.17);
    this.target.set(x, y, z);
  }
}
