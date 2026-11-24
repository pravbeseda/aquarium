import { Vector3 } from 'three';

/** Interior of the tank in metres. Y is up, the front glass faces +Z. */
export const TANK = {
  min: { x: -0.6, y: 0, z: -0.25 },
  max: { x: 0.6, y: 0.55, z: 0.25 },
  waterLevel: 0.5,
} as const;

export interface SphereObstacle {
  center: Vector3;
  radius: number;
}

interface Mound {
  x: number;
  z: number;
  radius: number;
  height: number;
}

// Hand-placed so the hardscape sits on raised ground, like a real aquascape.
const MOUNDS: Mound[] = [
  { x: -0.28, z: -0.08, radius: 0.16, height: 0.045 },
  { x: 0.24, z: -0.12, radius: 0.18, height: 0.04 },
  { x: -0.02, z: -0.16, radius: 0.12, height: 0.02 },
];

function ripple(x: number, z: number): number {
  return (
    0.004 * Math.sin(x * 23.0 + Math.sin(z * 17.0)) * Math.cos(z * 19.0 - x * 7.0) +
    0.002 * Math.sin(x * 61.0 + z * 43.0)
  );
}

/** Height of the substrate surface at (x, z): sloped front-to-back with mounds and fine ripples. */
export function substrateHeight(x: number, z: number): number {
  const back = (TANK.max.z - z) / (TANK.max.z - TANK.min.z); // 0 at the front glass, 1 at the back
  let h = 0.035 + 0.07 * back * back;
  for (const m of MOUNDS) {
    const d2 = ((x - m.x) ** 2 + (z - m.z) ** 2) / (m.radius * m.radius);
    h += m.height * Math.exp(-d2 * 2.2);
  }
  return h + ripple(x, z);
}

/** Keeps spherical bodies inside the water volume and outside the hardscape. */
export class TankCollider {
  readonly obstacles: SphereObstacle[];

  constructor(obstacles: SphereObstacle[]) {
    this.obstacles = obstacles;
  }

  /**
   * Moves `p` to the nearest valid position for a body of `radius`.
   * Returns the outward contact normal of the last correction, or null when no correction happened.
   */
  resolve(p: Vector3, radius: number): Vector3 | null {
    let normal: Vector3 | null = null;

    for (const o of this.obstacles) {
      const minDist = o.radius + radius;
      const dx = p.x - o.center.x;
      const dy = p.y - o.center.y;
      const dz = p.z - o.center.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < minDist * minDist) {
        const d = Math.sqrt(d2) || 1e-6;
        normal = new Vector3(dx / d, dy / d, dz / d);
        p.copy(o.center).addScaledVector(normal, minDist);
      }
    }

    const clampAxis = (axis: 'x' | 'z', lo: number, hi: number) => {
      if (p[axis] < lo) {
        p[axis] = lo;
        normal = axis === 'x' ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1);
      } else if (p[axis] > hi) {
        p[axis] = hi;
        normal = axis === 'x' ? new Vector3(-1, 0, 0) : new Vector3(0, 0, -1);
      }
    };
    clampAxis('x', TANK.min.x + radius, TANK.max.x - radius);
    clampAxis('z', TANK.min.z + radius, TANK.max.z - radius);

    const floor = substrateHeight(p.x, p.z) + radius;
    const ceiling = TANK.waterLevel - radius;
    if (p.y < floor) {
      p.y = floor;
      normal = new Vector3(0, 1, 0);
    } else if (p.y > ceiling) {
      p.y = ceiling;
      normal = new Vector3(0, -1, 0);
    }
    return normal;
  }
}
