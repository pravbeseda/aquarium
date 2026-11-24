import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { FoodSystem } from './food';
import { TANK, substrateHeight } from './tank';
import { mulberry32 } from '../core/random';

const dt = 1 / 30;

describe('FoodSystem', () => {
  it('drops a feeding on schedule', () => {
    const food = new FoodSystem(mulberry32(1), { firstFeeding: 2, interval: [30, 40], flakesPerFeeding: 10 });
    for (let t = 0; t < 1.9; t += dt) food.update(dt, []);
    expect(food.flakes.length).toBe(0);
    for (let t = 0; t < 0.2; t += dt) food.update(dt, []);
    expect(food.flakes.length).toBe(10);
    for (const f of food.flakes) expect(f.position.y).toBeCloseTo(TANK.waterLevel, 2);
  });

  it('lets flakes sink and settle on the substrate', () => {
    const food = new FoodSystem(mulberry32(2), { firstFeeding: 0, interval: [999, 999], flakesPerFeeding: 5 });
    for (let t = 0; t < 40; t += dt) food.update(dt, []);
    expect(food.flakes.length).toBe(5);
    for (const f of food.flakes) {
      expect(f.landed).toBe(true);
      expect(f.position.y).toBeCloseTo(substrateHeight(f.position.x, f.position.z), 3);
    }
  });

  it('removes a flake when an eater reaches it and reports who ate it', () => {
    const food = new FoodSystem(mulberry32(3), { firstFeeding: 0, interval: [999, 999], flakesPerFeeding: 1 });
    food.update(dt, []);
    const flake = food.flakes[0].position.clone();
    const eaten = food.update(dt, [{ position: flake, radius: 0.01 }, { position: new Vector3(9, 9, 9), radius: 0.01 }]);
    expect(eaten).toEqual([0]);
    expect(food.flakes.length).toBe(0);
  });

  it('dissolves settled flakes after a while', () => {
    const food = new FoodSystem(mulberry32(4), { firstFeeding: 0, interval: [999, 999], flakesPerFeeding: 3, settledLifetime: 5 });
    for (let t = 0; t < 60; t += dt) food.update(dt, []);
    expect(food.flakes.length).toBe(0);
  });
});
