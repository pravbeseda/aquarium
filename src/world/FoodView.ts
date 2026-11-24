import { BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Euler, Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { patchUnderwater, type UnderwaterUniforms } from '../render/underwaterMaterial';
import { mulberry32 } from '../core/random';
import type { Flake } from '../sim/food';

const COLORS = [new Color(0.75, 0.22, 0.1), new Color(0.8, 0.62, 0.15), new Color(0.35, 0.42, 0.14)];

/** Irregular thin polygon: a crumbled food flake. */
function flakeGeometry(): BufferGeometry {
  const rng = mulberry32(11);
  const corners = 9;
  const positions = [0, 0, 0];
  for (let i = 0; i < corners; i++) {
    const a = (i / corners) * Math.PI * 2;
    const r = 0.6 + rng() * 0.5;
    positions.push(Math.cos(a) * r, (rng() - 0.5) * 0.15, Math.sin(a) * r);
  }
  const index: number[] = [];
  for (let i = 0; i < corners; i++) index.push(0, 1 + i, 1 + ((i + 1) % corners));
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

export class FoodView {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly e = new Euler();
  private readonly s = new Vector3();

  constructor(u: UnderwaterUniforms, capacity: number) {
    const material = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.7 });
    patchUnderwater(material, u, { translucency: 0.5 });
    this.mesh = new InstancedMesh(flakeGeometry(), material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.count = 0;
  }

  update(flakes: readonly Flake[], settledLifetime: number): void {
    const n = Math.min(flakes.length, this.mesh.instanceMatrix.count);
    for (let i = 0; i < n; i++) {
      const f = flakes[i];
      if (f.landed) this.e.set(0, f.spin, 0);
      else this.e.set(f.spin, f.spin * 0.7, f.spin * 1.3);
      const dissolve = f.landed ? Math.max(0, 1 - Math.max(0, f.settledAge - (settledLifetime - 4)) / 4) : 1;
      this.s.setScalar(0.0035 * dissolve + 1e-5);
      this.mesh.setMatrixAt(i, this.m.compose(f.position, this.q.setFromEuler(this.e), this.s));
      this.mesh.setColorAt(i, COLORS[f.variant % COLORS.length]);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
