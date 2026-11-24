export type Rng = () => number;

/** Small deterministic PRNG so the aquascape is identical on every load. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** Approximately normal sample (Irwin–Hall with 3 terms), mean 0, sd ≈ 1. */
export function gaussian(rng: Rng): number {
  return (rng() + rng() + rng() - 1.5) * 2;
}
