import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { range, type Rng } from '../../core/random';

/** Collects vertices of a strip-built mesh. All plant geometry is one unit tall (local y in [0, 1]). */
class StripBuilder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  readonly indices: number[] = [];

  /** Adds a ribbon from left/right edge points per row. */
  addStrip(left: Vector3[], right: Vector3[], colorAt: (row: number) => Color): void {
    const start = this.positions.length / 3;
    for (let i = 0; i < left.length; i++) {
      const c = colorAt(i / (left.length - 1));
      for (const p of [left[i], right[i]]) {
        this.positions.push(p.x, p.y, p.z);
        this.colors.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < left.length - 1; i++) {
      const a = start + i * 2;
      this.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    return g;
  }
}

function gradient(from: Color, to: Color, power = 1) {
  const c = new Color();
  return (t: number) => c.copy(from).lerp(to, Math.pow(t, power));
}

/** One Vallisneria blade: a long twisting ribbon with a rounded tip. */
export function vallisneriaBlade(rng: Rng): BufferGeometry {
  const b = new StripBuilder();
  const rows = 18;
  const width = 0.024;
  const twist = range(rng, 1.5, 3.5);
  const lean = range(rng, 0.05, 0.14);
  const left: Vector3[] = [];
  const right: Vector3[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const w = width * 0.5 * (t > 0.92 ? Math.sqrt(Math.max(0, (1 - t) / 0.08)) : 1) * (0.85 + 0.15 * Math.sin(t * 3.1));
    const a = twist * t;
    const z = lean * t * t;
    left.push(new Vector3(-w * Math.cos(a), t, z - w * Math.sin(a)));
    right.push(new Vector3(w * Math.cos(a), t, z + w * Math.sin(a)));
  }
  b.addStrip(left, right, gradient(new Color(0.16, 0.26, 0.06), new Color(0.42, 0.7, 0.2), 0.6));
  return b.build();
}

/** A tuft of dwarf hairgrass: needle-thin blades fanning out from one point. */
export function hairgrassTuft(rng: Rng): BufferGeometry {
  const b = new StripBuilder();
  const blades = 16;
  const color = gradient(new Color(0.12, 0.24, 0.05), new Color(0.45, 0.78, 0.18), 0.7);
  for (let k = 0; k < blades; k++) {
    const a = rng() * Math.PI * 2;
    const r0 = Math.sqrt(rng()) * 0.1;
    const lean = range(rng, 0.04, 0.28);
    const height = range(rng, 0.6, 1.0);
    const bx = Math.cos(a) * r0;
    const bz = Math.sin(a) * r0;
    const dx = Math.cos(a + range(rng, -0.5, 0.5));
    const dz = Math.sin(a + range(rng, -0.5, 0.5));
    const left: Vector3[] = [];
    const right: Vector3[] = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const w = 0.011 * (1 - t * 0.85);
      const x = bx + dx * lean * t * t;
      const z = bz + dz * lean * t * t;
      left.push(new Vector3(x - dz * w, t * height, z + dx * w));
      right.push(new Vector3(x + dz * w, t * height, z - dx * w));
    }
    b.addStrip(left, right, color);
  }
  return b.build();
}

/** A Rotala-like stem: thin stem with paired leaves, turning orange-red towards the light. */
export function stemPlant(rng: Rng): BufferGeometry {
  const b = new StripBuilder();
  const stemColor = gradient(new Color(0.2, 0.25, 0.08), new Color(0.55, 0.3, 0.12));
  // Stem as a narrow cross of two ribbons.
  for (const rot of [0, Math.PI / 2]) {
    const left: Vector3[] = [];
    const right: Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const w = 0.006;
      left.push(new Vector3(-w * Math.cos(rot), t, -w * Math.sin(rot)));
      right.push(new Vector3(w * Math.cos(rot), t, w * Math.sin(rot)));
    }
    b.addStrip(left, right, stemColor);
  }

  const green = new Color(0.2, 0.45, 0.1);
  const tipColor = new Color().setHSL(range(rng, 0.0, 0.06), 0.75, 0.42);
  const nodes = 18;
  for (let n = 1; n <= nodes; n++) {
    const t = n / nodes;
    const phase = (n % 2) * (Math.PI / 2) + range(rng, -0.2, 0.2);
    const len = 0.075 * (t > 0.8 ? 1 - (t - 0.8) * 2.5 : 1) * range(rng, 0.85, 1.1);
    const up = 0.6 + t * 0.7;
    const tint = new Color().copy(green).lerp(tipColor, Math.max(0, (t - 0.45) / 0.55) ** 1.4);
    for (const side of [0, Math.PI]) {
      const a = phase + side;
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      const perp = new Vector3(-dir.z, 0, dir.x);
      const left: Vector3[] = [];
      const right: Vector3[] = [];
      for (let i = 0; i <= 4; i++) {
        const s = i / 4;
        const w = 0.014 * Math.sin(Math.PI * Math.min(1, s * 1.05 + 0.02));
        const reach = s * len;
        const centre = new Vector3(dir.x * reach * Math.cos(up * 0.6), t + reach * Math.sin(up * 0.6), dir.z * reach * Math.cos(up * 0.6));
        left.push(centre.clone().addScaledVector(perp, -w));
        right.push(centre.clone().addScaledVector(perp, w));
      }
      b.addStrip(left, right, () => tint);
    }
  }
  return b.build();
}
