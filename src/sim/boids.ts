import { Vector3 } from 'three';
import type { Rng } from '../core/random';
import { TANK, substrateHeight, type TankCollider } from './tank';

export interface BoidContext {
  collider: TankCollider;
  /** Something the fish should avoid, usually the player. */
  threat?: Vector3;
  /** Food the fish should swim to. */
  food?: readonly Vector3[];
}

const P = {
  minSpeed: 0.04,
  maxSpeed: 0.16,
  fleeSpeed: 0.34,
  neighborRadius: 0.07,
  separationRadius: 0.022,
  fleeRadius: 0.12,
  foodRadius: 0.45,
  wallMargin: 0.06,
  bodyRadius: 0.006,
  weights: { separation: 2.2, alignment: 0.9, cohesion: 0.7, wander: 0.35, walls: 2.6, obstacles: 3, flee: 5, food: 1.6 },
  maxForce: 0.5,
} as const;

const tmp = new Vector3();
const force = new Vector3();
const sep = new Vector3();
const ali = new Vector3();
const coh = new Vector3();
const pos = new Vector3();
const vel = new Vector3();

/** A school of small fish (neon tetras) using classic separation/alignment/cohesion steering. */
export class Boids {
  readonly count: number;
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  /** Slowly roaming point the whole school drifts towards, so it explores the tank. */
  readonly roamTarget = new Vector3();
  private readonly rng: Rng;
  private roamTimer = 0;

  constructor(count: number, rng: Rng, center: Vector3, spread: number) {
    this.count = count;
    this.rng = rng;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = center.x + (rng() - 0.5) * 2 * spread;
      this.positions[i * 3 + 1] = center.y + (rng() - 0.5) * spread;
      this.positions[i * 3 + 2] = center.z + (rng() - 0.5) * spread;
      this.velocities[i * 3] = (rng() - 0.5) * 0.05 + 0.06;
      this.velocities[i * 3 + 1] = 0;
      this.velocities[i * 3 + 2] = (rng() - 0.5) * 0.05;
    }
    this.roamTarget.copy(center);
  }

  position(i: number, target: Vector3): Vector3 {
    return target.fromArray(this.positions, i * 3);
  }

  velocity(i: number, target: Vector3): Vector3 {
    return target.fromArray(this.velocities, i * 3);
  }

  step(dt: number, ctx: BoidContext): void {
    this.updateRoam(dt);
    const { weights: w } = P;

    for (let i = 0; i < this.count; i++) {
      this.position(i, pos);
      this.velocity(i, vel);
      force.set(0, 0, 0);
      sep.set(0, 0, 0);
      ali.set(0, 0, 0);
      coh.set(0, 0, 0);
      let neighbors = 0;

      for (let j = 0; j < this.count; j++) {
        if (j === i) continue;
        const dx = this.positions[j * 3] - pos.x;
        const dy = this.positions[j * 3 + 1] - pos.y;
        const dz = this.positions[j * 3 + 2] - pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > P.neighborRadius * P.neighborRadius) continue;
        neighbors++;
        coh.x += dx;
        coh.y += dy;
        coh.z += dz;
        ali.x += this.velocities[j * 3];
        ali.y += this.velocities[j * 3 + 1];
        ali.z += this.velocities[j * 3 + 2];
        if (d2 < P.separationRadius * P.separationRadius && d2 > 1e-10) {
          const inv = 1 / d2;
          sep.x -= dx * inv * 0.001;
          sep.y -= dy * inv * 0.001;
          sep.z -= dz * inv * 0.001;
        }
      }

      if (neighbors > 0) {
        force.addScaledVector(sep, w.separation * 20);
        ali.divideScalar(neighbors).sub(vel);
        force.addScaledVector(ali, w.alignment * 4);
        coh.divideScalar(neighbors);
        force.addScaledVector(coh, w.cohesion * 6);
      }

      let maxSpeed: number = P.maxSpeed;
      let chasing = false;

      if (ctx.food && ctx.food.length > 0) {
        let best: Vector3 | null = null;
        let bestD: number = P.foodRadius;
        for (const f of ctx.food) {
          const d = f.distanceTo(pos);
          if (d < bestD) {
            bestD = d;
            best = f;
          }
        }
        if (best) {
          tmp.subVectors(best, pos).setLength(P.maxSpeed).sub(vel);
          force.addScaledVector(tmp, w.food * 6);
          chasing = true;
        }
      }

      if (!chasing) {
        tmp.subVectors(this.roamTarget, pos);
        force.addScaledVector(tmp, w.wander);
      }

      if (ctx.threat) {
        tmp.subVectors(pos, ctx.threat);
        const d = tmp.length();
        if (d < P.fleeRadius && d > 1e-6) {
          const urgency = 1 - d / P.fleeRadius;
          force.addScaledVector(tmp.divideScalar(d), w.flee * urgency * 1.5);
          maxSpeed = P.fleeSpeed;
        }
      }

      this.avoidWalls(pos, force);
      this.avoidObstacles(pos, ctx.collider, force);

      // Fish keep roughly level: damp vertical drift.
      force.y -= vel.y * 1.5;

      const fl = force.length();
      const maxForce = maxSpeed > P.maxSpeed ? P.maxForce * 4 : P.maxForce;
      if (fl > maxForce) force.multiplyScalar(maxForce / fl);

      vel.addScaledVector(force, dt);
      const speed = vel.length();
      if (speed > maxSpeed) vel.multiplyScalar(maxSpeed / speed);
      else if (speed < P.minSpeed) vel.multiplyScalar(P.minSpeed / Math.max(speed, 1e-6));

      pos.addScaledVector(vel, dt);
      ctx.collider.resolve(pos, P.bodyRadius);
      pos.toArray(this.positions, i * 3);
      vel.toArray(this.velocities, i * 3);
    }
  }

  private updateRoam(dt: number): void {
    this.roamTimer -= dt;
    if (this.roamTimer > 0) return;
    this.roamTimer = 6 + this.rng() * 8;
    const x = TANK.min.x + 0.15 + this.rng() * (TANK.max.x - TANK.min.x - 0.3);
    const z = TANK.min.z + 0.08 + this.rng() * (TANK.max.z - TANK.min.z - 0.16);
    const floor = substrateHeight(x, z);
    const y = floor + 0.08 + this.rng() * (TANK.waterLevel - floor - 0.16);
    this.roamTarget.set(x, y, z);
  }

  private avoidWalls(p: Vector3, out: Vector3): void {
    const m = P.wallMargin;
    const push = (dist: number) => (dist < m ? (1 - dist / m) ** 2 * P.weights.walls : 0);
    out.x += push(p.x - TANK.min.x) - push(TANK.max.x - p.x);
    out.z += push(p.z - TANK.min.z) - push(TANK.max.z - p.z);
    out.y += push(p.y - substrateHeight(p.x, p.z)) - push(TANK.waterLevel - p.y);
  }

  private avoidObstacles(p: Vector3, collider: TankCollider, out: Vector3): void {
    for (const o of collider.obstacles) {
      tmp.subVectors(p, o.center);
      const d = tmp.length();
      const reach = o.radius + P.wallMargin;
      if (d < reach && d > 1e-6) out.addScaledVector(tmp.divideScalar(d), (1 - (d - o.radius) / P.wallMargin) * P.weights.obstacles);
    }
  }
}
