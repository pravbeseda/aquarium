import { describe, expect, it } from 'vitest';
import { joystickVector } from './joystick';

describe('joystickVector', () => {
  it('returns zero inside the dead zone', () => {
    expect(joystickVector(3, -2, 60)).toEqual({ x: 0, y: 0 });
  });

  it('maps screen-up drag to forward (positive y)', () => {
    const v = joystickVector(0, -60, 60);
    expect(v.y).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(0);
  });

  it('clamps magnitude to 1 beyond the radius', () => {
    const v = joystickVector(300, 0, 60);
    expect(v.x).toBeCloseTo(1);
    expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('rescales smoothly from the dead-zone edge', () => {
    const v = joystickVector(30, 0, 60, 0.2);
    expect(v.x).toBeCloseTo((0.5 - 0.2) / 0.8);
  });
});
