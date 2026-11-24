import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { SWIM, applyLook, createSwimmer, forwardVector, stepSwimmer, type SwimIntent } from './swim';
import { TankCollider } from './tank';

const idle: SwimIntent = { forward: 0, strafe: 0, rise: 0, boost: false };
const collider = new TankCollider([]);

function run(intent: SwimIntent, seconds: number, yaw = 0, pitch = 0) {
  const s = createSwimmer(new Vector3(0, 0.3, 0), yaw, pitch);
  for (let t = 0; t < seconds; t += 1 / 60) stepSwimmer(s, intent, 1 / 60, collider);
  return s;
}

describe('swimmer', () => {
  it('looks down -Z with zero yaw and pitch', () => {
    const f = forwardVector(0, 0);
    expect(f.z).toBeCloseTo(-1);
    expect(f.x).toBeCloseTo(0);
  });

  it('accelerates along the look direction', () => {
    const s = run({ ...idle, forward: 1 }, 0.5, Math.PI / 2);
    expect(s.velocity.x).toBeLessThan(-0.05);
    expect(Math.abs(s.velocity.z)).toBeLessThan(1e-6);
  });

  it('never exceeds cruise speed, and boost goes faster', () => {
    const cruise = run({ ...idle, forward: 1 }, 0.3);
    const boost = run({ ...idle, forward: 1, boost: true }, 0.3);
    expect(cruise.velocity.length()).toBeLessThanOrEqual(SWIM.cruiseSpeed + 1e-6);
    expect(boost.velocity.length()).toBeGreaterThan(cruise.velocity.length());
    expect(boost.velocity.length()).toBeLessThanOrEqual(SWIM.boostSpeed + 1e-6);
  });

  it('glides to a stop without input', () => {
    const s = createSwimmer(new Vector3(0, 0.3, 0), 0, 0);
    s.velocity.set(0.2, 0, 0);
    for (let i = 0; i < 240; i++) stepSwimmer(s, idle, 1 / 60, collider);
    expect(s.velocity.length()).toBeLessThan(0.005);
  });

  it('clamps pitch so the fish cannot flip over', () => {
    const s = createSwimmer(new Vector3(), 0, 0);
    applyLook(s, 0, 10);
    expect(s.pitch).toBeLessThanOrEqual(SWIM.maxPitch);
    applyLook(s, 0, -20);
    expect(s.pitch).toBeGreaterThanOrEqual(-SWIM.maxPitch);
  });

  it('loses the velocity component that pushes into a wall', () => {
    const s = run({ ...idle, forward: 1 }, 20, -Math.PI / 2);
    expect(s.velocity.x).toBeLessThan(0.02);
  });
});
