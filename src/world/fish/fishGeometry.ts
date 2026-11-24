import { BufferGeometry, Float32BufferAttribute, Shape, ShapeGeometry, Vector2 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Fish are modelled one unit long, nose at z = +0.5 and tail at z = -0.5, back towards +y.
 * UVs: u runs nose→tail (0→1); for the body v runs around the cross-section from the back (0)
 * over the right flank (0.25), the belly (0.5) and the left flank (0.75).
 */
export interface FishProfile {
  /** Fraction of the length taken by the body; the caudal fin covers the rest. */
  bodyLength: number;
  /** Samples along the body (s in [0, 1]): half height, half width, centre-line offset. */
  stations: ReadonlyArray<{ s: number; halfHeight: number; halfWidth: number; centreY: number }>;
}

function sampleProfile(p: FishProfile, s: number) {
  const st = p.stations;
  let i = 0;
  while (i < st.length - 2 && st[i + 1].s < s) i++;
  const a = st[i];
  const b = st[i + 1];
  const t = Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s)));
  const k = t * t * (3 - 2 * t);
  return {
    hh: a.halfHeight + (b.halfHeight - a.halfHeight) * k,
    hw: a.halfWidth + (b.halfWidth - a.halfWidth) * k,
    cy: a.centreY + (b.centreY - a.centreY) * k,
  };
}

export function fishBody(profile: FishProfile, rings = 36, segments = 22): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const s = Math.pow(i / rings, 1.25);
    const z = 0.5 - s * profile.bodyLength;
    const { hh, hw, cy } = sampleProfile(profile, s);
    for (let j = 0; j <= segments; j++) {
      const v = j / segments;
      const a = v * Math.PI * 2;
      // Slightly flattened flanks read as a fish rather than a tube.
      const sx = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.85);
      positions.push(hw * sx, cy + hh * Math.cos(a), z);
      uvs.push(0.5 - z, v);
    }
  }
  const row = segments + 1;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * row + j;
      indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** A flat fin from an outline in the (z, y) plane, placed at lateral offset x and optionally tilted outwards. */
export function fin(outline: ReadonlyArray<[number, number]>, x = 0, tilt = 0): BufferGeometry {
  const shape = new Shape(outline.map(([z, y]) => new Vector2(z, y)));
  const g = new ShapeGeometry(shape, 6);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getX(i);
    const y = pos.getY(i);
    pos.setXYZ(i, x + Math.sin(tilt) * Math.abs(y), y * Math.cos(tilt), z);
    uv.setXY(i, 0.5 - z, 0.5 + y);
  }
  g.computeVertexNormals();
  return g;
}

export function fins(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('Fin geometries are incompatible');
  return merged;
}

export const NEON_PROFILE: FishProfile = {
  bodyLength: 0.84,
  stations: [
    { s: 0, halfHeight: 0.004, halfWidth: 0.004, centreY: -0.01 },
    { s: 0.06, halfHeight: 0.06, halfWidth: 0.045, centreY: -0.006 },
    { s: 0.18, halfHeight: 0.092, halfWidth: 0.055, centreY: -0.004 },
    { s: 0.36, halfHeight: 0.104, halfWidth: 0.05, centreY: -0.008 },
    { s: 0.55, halfHeight: 0.092, halfWidth: 0.04, centreY: -0.004 },
    { s: 0.75, halfHeight: 0.058, halfWidth: 0.026, centreY: 0.002 },
    { s: 0.9, halfHeight: 0.038, halfWidth: 0.016, centreY: 0.004 },
    { s: 1, halfHeight: 0.042, halfWidth: 0.008, centreY: 0.004 },
  ],
};

export function neonFins(): BufferGeometry {
  return fins([
    // Forked caudal fin.
    fin([[-0.33, 0.035], [-0.42, 0.075], [-0.5, 0.115], [-0.47, 0.05], [-0.43, 0.0], [-0.47, -0.05], [-0.5, -0.115], [-0.42, -0.075], [-0.33, -0.035]]),
    fin([[0.02, 0.09], [-0.03, 0.17], [-0.08, 0.175], [-0.1, 0.085]]), // dorsal
    fin([[-0.24, 0.05], [-0.25, 0.085], [-0.28, 0.075], [-0.28, 0.04]]), // adipose
    fin([[-0.02, -0.085], [-0.06, -0.15], [-0.26, -0.11], [-0.3, -0.045]]), // anal
    fin([[0.27, -0.02], [0.18, -0.06], [0.15, -0.04], [0.2, -0.01]], 0.045, 0.5), // pectorals
    fin([[0.27, -0.02], [0.18, -0.06], [0.15, -0.04], [0.2, -0.01]], -0.045, -0.5),
    fin([[0.12, -0.09], [0.06, -0.15], [0.03, -0.14], [0.08, -0.09]], 0.012, 0.25), // pelvics
    fin([[0.12, -0.09], [0.06, -0.15], [0.03, -0.14], [0.08, -0.09]], -0.012, -0.25),
  ]);
}

export const ANGEL_PROFILE: FishProfile = {
  bodyLength: 0.78,
  stations: [
    { s: 0, halfHeight: 0.01, halfWidth: 0.005, centreY: 0.02 },
    { s: 0.07, halfHeight: 0.1, halfWidth: 0.03, centreY: 0.03 },
    { s: 0.2, halfHeight: 0.22, halfWidth: 0.042, centreY: 0.02 },
    { s: 0.4, halfHeight: 0.3, halfWidth: 0.045, centreY: 0.0 },
    { s: 0.58, halfHeight: 0.27, halfWidth: 0.036, centreY: 0.0 },
    { s: 0.76, halfHeight: 0.15, halfWidth: 0.022, centreY: 0.0 },
    { s: 0.9, halfHeight: 0.08, halfWidth: 0.013, centreY: 0.0 },
    { s: 1, halfHeight: 0.085, halfWidth: 0.008, centreY: 0.0 },
  ],
};

export function angelFins(): BufferGeometry {
  return fins([
    fin([[-0.27, 0.07], [-0.36, 0.2], [-0.5, 0.24], [-0.46, 0.0], [-0.5, -0.24], [-0.36, -0.2], [-0.27, -0.07]]), // caudal
    fin([[0.2, 0.26], [0.0, 0.48], [-0.22, 0.72], [-0.3, 0.68], [-0.22, 0.3], [-0.12, 0.2]]), // dorsal sail
    fin([[0.15, -0.27], [-0.02, -0.5], [-0.22, -0.74], [-0.3, -0.7], [-0.22, -0.3], [-0.12, -0.2]]), // anal sail
    fin([[0.2, -0.2], [0.05, -0.62], [0.02, -0.64], [0.14, -0.2]], 0.02, 0.15), // ventral filaments
    fin([[0.2, -0.2], [0.05, -0.62], [0.02, -0.64], [0.14, -0.2]], -0.02, -0.15),
    fin([[0.28, 0.0], [0.18, -0.06], [0.14, -0.02], [0.2, 0.02]], 0.06, 0.6), // pectorals
    fin([[0.28, 0.0], [0.18, -0.06], [0.14, -0.02], [0.2, 0.02]], -0.06, -0.6),
  ]);
}
