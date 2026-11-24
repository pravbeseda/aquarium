import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Boids } from './boids';
import { TANK, TankCollider, substrateHeight } from './tank';
import { mulberry32 } from '../core/random';

const collider = new TankCollider([]);
const dt = 1 / 60;

function school(count = 24) {
  return new Boids(count, mulberry32(7), new Vector3(0, 0.3, 0), 0.08);
}

describe('Boids', () => {
  it('keeps every fish inside the water volume', () => {
    const b = school();
    for (let i = 0; i < 1200; i++) b.step(dt, { collider });
    for (let i = 0; i < b.count; i++) {
      const p = b.position(i, new Vector3());
      expect(p.x).toBeGreaterThan(TANK.min.x);
      expect(p.x).toBeLessThan(TANK.max.x);
      expect(p.z).toBeGreaterThan(TANK.min.z);
      expect(p.z).toBeLessThan(TANK.max.z);
      expect(p.y).toBeLessThan(TANK.waterLevel);
      expect(p.y).toBeGreaterThan(substrateHeight(p.x, p.z));
    }
  });

  it('flees from a nearby threat', () => {
    const b = school();
    const threat = b.position(0, new Vector3()).add(new Vector3(0.02, 0, 0));
    const before = b.position(0, new Vector3()).distanceTo(threat);
    for (let i = 0; i < 30; i++) b.step(dt, { collider, threat });
    expect(b.position(0, new Vector3()).distanceTo(threat)).toBeGreaterThan(before + 0.01);
  });

  it('moves towards food', () => {
    const b = school();
    const food = [new Vector3(0.4, 0.4, 0.15)];
    const meanDistance = () => {
      let sum = 0;
      for (let i = 0; i < b.count; i++) sum += b.position(i, new Vector3()).distanceTo(food[0]);
      return sum / b.count;
    };
    const before = meanDistance();
    for (let i = 0; i < 180; i++) b.step(dt, { collider, food });
    expect(meanDistance()).toBeLessThan(before * 0.7);
  });
});
