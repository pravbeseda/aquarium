import { Group, Vector3 } from 'three';
import { Boids } from '../../sim/boids';
import { Wanderer } from '../../sim/wanderer';
import type { Eater } from '../../sim/food';
import type { TankCollider } from '../../sim/tank';
import { mulberry32 } from '../../core/random';
import type { UnderwaterUniforms } from '../../render/underwaterMaterial';
import { InstancedFish } from './InstancedFish';
import { ANGEL_PROFILE, NEON_PROFILE, angelFins, fishBody, neonFins } from './fishGeometry';
import { angelTextures, neonTextures } from './fishTextures';

const NEON_LENGTH = 0.032;
const ANGEL_LENGTH = 0.11;
const pos = new Vector3();
const vel = new Vector3();
const dir = new Vector3();

interface Swimmer {
  heading: Vector3;
  phase: number;
  scale: number;
}

/** All non-player fish: a school of neon tetras and a few angelfish. */
export class FishLife {
  readonly group = new Group();
  readonly school: Boids;
  private readonly neons: InstancedFish;
  private readonly neonState: Swimmer[];
  private readonly angels: Wanderer[];
  private readonly angelFish: InstancedFish;
  private readonly angelState: Swimmer[];
  private readonly eaters: Eater[];

  constructor(u: UnderwaterUniforms, neonCount: number) {
    const rng = mulberry32(99);
    this.school = new Boids(neonCount, rng, new Vector3(0.15, 0.28, 0.05), 0.1);
    this.neons = new InstancedFish(u, { textures: neonTextures(), body: fishBody(NEON_PROFILE), fins: neonFins(), length: NEON_LENGTH, iridescence: 1, roughness: 0.3 }, neonCount);
    this.neonState = Array.from({ length: neonCount }, () => ({ heading: new Vector3(1, 0, 0), phase: rng() * 10, scale: 0.85 + rng() * 0.3 }));
    this.eaters = Array.from({ length: neonCount }, () => ({ position: new Vector3(), radius: 0.008 }));

    const starts = [new Vector3(-0.3, 0.3, 0.06), new Vector3(0.05, 0.38, -0.1), new Vector3(-0.1, 0.42, 0.13)];
    this.angels = starts.map((s) => new Wanderer(rng, s, 0.045));
    this.angelFish = new InstancedFish(u, { textures: angelTextures(), body: fishBody(ANGEL_PROFILE, 40, 26), fins: angelFins(), length: ANGEL_LENGTH, iridescence: 0.35, roughness: 0.35 }, starts.length);
    this.angelState = starts.map(() => ({ heading: new Vector3(1, 0, 0), phase: rng() * 10, scale: 0.85 + rng() * 0.3 }));

    this.group.add(this.neons.group, this.angelFish.group);
  }

  update(dt: number, collider: TankCollider, player: Vector3, food: readonly Vector3[]): void {
    this.school.step(dt, { collider, threat: player, food });
    for (let i = 0; i < this.school.count; i++) {
      this.school.position(i, pos);
      this.school.velocity(i, vel);
      const s = this.neonState[i];
      const speed = vel.length();
      s.heading.lerp(dir.copy(vel).normalize(), 1 - Math.exp(-dt * 8)).normalize();
      s.phase += dt * (14 + speed * 160);
      this.neons.set(i, pos, s.heading, s.phase, 0.16 + Math.min(speed * 1.5, 0.3), s.scale);
      this.eaters[i].position.copy(pos).addScaledVector(s.heading, NEON_LENGTH * 0.5);
    }
    this.neons.commit();

    this.angels.forEach((a, i) => {
      a.step(dt, { collider, threat: player });
      const s = this.angelState[i];
      const speed = a.velocity.length();
      s.heading.lerp(dir.copy(a.velocity).normalize(), 1 - Math.exp(-dt * 2.5)).normalize();
      s.phase += dt * (5 + speed * 60);
      this.angelFish.set(i, a.position, s.heading, s.phase, 0.06 + Math.min(speed * 1.2, 0.12), s.scale);
    });
    this.angelFish.commit();
  }

  /** Mouths of the school, for the food system. */
  get mouths(): readonly Eater[] {
    return this.eaters;
  }
}
