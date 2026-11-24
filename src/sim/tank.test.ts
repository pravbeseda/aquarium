import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { TANK, TankCollider, substrateHeight } from './tank';

describe('substrateHeight', () => {
  it('stays within a plausible aquascape range across the whole floor', () => {
    for (let x = TANK.min.x; x <= TANK.max.x; x += 0.05) {
      for (let z = TANK.min.z; z <= TANK.max.z; z += 0.05) {
        const h = substrateHeight(x, z);
        expect(h).toBeGreaterThan(0.015);
        expect(h).toBeLessThan(0.2);
      }
    }
  });

  it('slopes up towards the back glass', () => {
    let front = 0;
    let back = 0;
    for (let x = TANK.min.x; x <= TANK.max.x; x += 0.1) {
      front += substrateHeight(x, TANK.max.z - 0.02);
      back += substrateHeight(x, TANK.min.z + 0.02);
    }
    expect(back).toBeGreaterThan(front);
  });
});

describe('TankCollider', () => {
  const collider = new TankCollider([{ center: new Vector3(0, 0.1, 0), radius: 0.05 }]);
  const r = 0.02;

  it('keeps a body inside the glass walls', () => {
    const p = new Vector3(5, 0.3, -5);
    collider.resolve(p, r);
    expect(p.x).toBeCloseTo(TANK.max.x - r);
    expect(p.z).toBeCloseTo(TANK.min.z + r);
  });

  it('keeps a body below the water surface and above the substrate', () => {
    const high = new Vector3(0.4, 2, 0.1);
    collider.resolve(high, r);
    expect(high.y).toBeCloseTo(TANK.waterLevel - r);

    const low = new Vector3(0.4, -1, 0.1);
    collider.resolve(low, r);
    expect(low.y).toBeCloseTo(substrateHeight(0.4, 0.1) + r);
  });

  it('pushes a body out of an obstacle and reports the contact normal', () => {
    const p = new Vector3(0.01, 0.1, 0);
    const normal = collider.resolve(p, r);
    expect(p.distanceTo(new Vector3(0, 0.1, 0))).toBeCloseTo(0.05 + r);
    expect(normal).not.toBeNull();
    expect(normal!.x).toBeGreaterThan(0.9);
  });

  it('reports no contact for a body in open water', () => {
    const p = new Vector3(0.3, 0.3, 0.05);
    expect(collider.resolve(p, r)).toBeNull();
    expect(p.toArray()).toEqual([0.3, 0.3, 0.05]);
  });
});
