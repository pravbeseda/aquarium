import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { range, type Rng } from '../../core/random';

/**
 * Collects ribbon-shaped meshes. All plant geometry is one unit tall (local y in [0, 1]).
 * UVs: u runs across a ribbon (0 → 1), v along it (0 at the base).
 */
class RibbonBuilder {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private readonly uvs: number[] = [];
  private readonly indices: number[] = [];

  /** Adds a ribbon from rows of points across it (two or more per row). */
  add(rows: Vector3[][], colorAt: (along: number) => Color): void {
    const start = this.positions.length / 3;
    const columns = rows[0].length;
    rows.forEach((row, i) => {
      const along = i / (rows.length - 1);
      const c = colorAt(along);
      row.forEach((p, j) => {
        this.positions.push(p.x, p.y, p.z);
        this.colors.push(c.r, c.g, c.b);
        this.uvs.push(j / (columns - 1), along);
      });
    });
    for (let i = 0; i < rows.length - 1; i++) {
      for (let j = 0; j < columns - 1; j++) {
        const a = start + i * columns + j;
        const b = a + columns;
        this.indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    g.setIndex(this.indices);
    g.computeVertexNormals();
    return g;
  }
}

function gradient(from: Color, to: Color, power = 1) {
  const c = new Color();
  return (t: number) => c.copy(from).lerp(to, Math.pow(t, power));
}

/** One Vallisneria blade: a long, slightly folded, twisting ribbon with a rounded tip. */
export function vallisneriaBlade(rng: Rng): BufferGeometry {
  const b = new RibbonBuilder();
  const rows = 36;
  const width = 0.024;
  const twist = range(rng, 1.5, 3.5);
  const lean = range(rng, 0.05, 0.14);
  const wavePhase = rng() * 6;
  const waveAmp = range(rng, 0.004, 0.012);
  const ribbon: Vector3[][] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const tip = t > 0.92 ? Math.sqrt(Math.max(0, (1 - t) / 0.08)) : 1;
    const half = width * 0.5 * tip * (0.8 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.6))) * (0.94 + 0.06 * Math.sin(t * 23 + wavePhase));
    const a = twist * t;
    const across = new Vector3(Math.cos(a), 0, Math.sin(a));
    const normal = new Vector3(-Math.sin(a), 0, Math.cos(a));
    const centre = new Vector3(waveAmp * Math.sin(t * 6 + wavePhase), t, lean * t * t);
    // The midrib sits a little proud of the edges, so the blade is a shallow V rather than a flat strip.
    ribbon.push([
      centre.clone().addScaledVector(across, -half),
      centre.clone().addScaledVector(normal, half * 0.35),
      centre.clone().addScaledVector(across, half),
    ]);
  }
  b.add(ribbon, gradient(new Color(0.16, 0.26, 0.06), new Color(0.42, 0.7, 0.2), 0.6));
  return b.build();
}

/** A tuft of dwarf hairgrass: needle-thin blades fanning out from one point. */
export function hairgrassTuft(rng: Rng): BufferGeometry {
  const b = new RibbonBuilder();
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
    const blade: Vector3[][] = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const w = 0.011 * (1 - t * 0.85);
      const x = bx + dx * lean * t * t;
      const z = bz + dz * lean * t * t;
      blade.push([new Vector3(x - dz * w, t * height, z + dx * w), new Vector3(x + dz * w, t * height, z - dx * w)]);
    }
    b.add(blade, color);
  }
  return b.build();
}

/** A Rotala-like stem: thin stem with paired, curling leaves, turning orange-red towards the light. */
export function stemPlant(rng: Rng): BufferGeometry {
  const b = new RibbonBuilder();
  const stemColor = gradient(new Color(0.2, 0.25, 0.08), new Color(0.55, 0.3, 0.12));
  // Stem as a narrow cross of two ribbons.
  for (const rot of [0, Math.PI / 2]) {
    const stem: Vector3[][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const w = 0.006;
      stem.push([new Vector3(-w * Math.cos(rot), t, -w * Math.sin(rot)), new Vector3(w * Math.cos(rot), t, w * Math.sin(rot))]);
    }
    b.add(stem, stemColor);
  }

  const green = new Color(0.2, 0.45, 0.1);
  const tipColor = new Color().setHSL(range(rng, 0.0, 0.06), 0.75, 0.42);
  const nodes = 18;
  const up = new Vector3(0, 1, 0);
  for (let n = 1; n <= nodes; n++) {
    const t = n / nodes;
    const phase = (n % 2) * (Math.PI / 2) + range(rng, -0.2, 0.2);
    const len = 0.075 * (t > 0.8 ? 1 - (t - 0.8) * 2.5 : 1) * range(rng, 0.85, 1.1);
    const rise = (0.6 + t * 0.7) * 0.6;
    const droop = range(rng, 0.15, 0.35);
    const tint = new Color().copy(green).lerp(tipColor, Math.max(0, (t - 0.45) / 0.55) ** 1.4);
    for (const side of [0, Math.PI]) {
      const a = phase + side;
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      const perp = new Vector3(-dir.z, 0, dir.x);
      const leaf: Vector3[][] = [];
      for (let i = 0; i <= 8; i++) {
        const s = i / 8;
        const w = 0.014 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.04 + 0.02)), 0.8);
        const reach = s * len;
        const centre = new Vector3(0, t, 0)
          .addScaledVector(dir, reach * Math.cos(rise))
          .addScaledVector(up, reach * Math.sin(rise) - droop * len * s * s);
        leaf.push([centre.clone().addScaledVector(perp, -w), centre.clone().addScaledVector(up, w * 0.3), centre.clone().addScaledVector(perp, w)]);
      }
      b.add(leaf, () => tint);
    }
  }
  return b.build();
}
