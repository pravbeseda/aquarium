import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Wanderer } from './wanderer';
import { TANK, TankCollider, substrateHeight } from './tank';
import { mulberry32 } from '../core/random';

const collider = new TankCollider([{ center: new Vector3(0, 0.15, 0), radius: 0.08 }]);
const dt = 1 / 60;

describe('Wanderer', () => {
  it('cruises around without leaving the water or entering obstacles', () => {
    const w = new Wanderer(mulberry32(5), new Vector3(0.3, 0.3, 0), 0.06);
    const visited = new Set<string>();
    for (let i = 0; i < 6000; i++) {
      w.step(dt, { collider });
      const p = w.position;
      expect(p.x).toBeGreaterThan(TANK.min.x);
      expect(p.x).toBeLessThan(TANK.max.x);
      expect(p.y).toBeLessThan(TANK.waterLevel);
      expect(p.y).toBeGreaterThan(substrateHeight(p.x, p.z));
      expect(p.distanceTo(new Vector3(0, 0.15, 0))).toBeGreaterThan(0.08);
      visited.add(`${Math.floor(p.x * 5)},${Math.floor(p.z * 5)}`);
    }
    expect(visited.size).toBeGreaterThan(3);
  });

  it('turns away from a close threat', () => {
    const w = new Wanderer(mulberry32(6), new Vector3(0.2, 0.3, 0), 0.06);
    const threat = new Vector3(0.23, 0.3, 0);
    for (let i = 0; i < 90; i++) w.step(dt, { collider, threat });
    expect(w.position.distanceTo(threat)).toBeGreaterThan(0.08);
  });
});
