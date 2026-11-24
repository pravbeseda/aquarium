import { Color, DoubleSide, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three';
import { TANK, substrateHeight, type SphereObstacle } from '../../sim/tank';
import { createMotionDepthMaterial, patchUnderwater, type SwayOptions, type UnderwaterUniforms } from '../../render/underwaterMaterial';
import { mulberry32, range, type Rng } from '../../core/random';
import { hairgrassTuft, stemPlant, vallisneriaBlade } from './plantGeometry';
import type { QualitySettings } from '../../app/settings';

interface Spot {
  x: number;
  z: number;
  scale: number;
}

interface Species {
  name: string;
  variants: number;
  build: (rng: Rng) => BufferGeometry;
  sway: SwayOptions;
  translucency: number;
  roughness: number;
  castShadow: boolean;
  tint: (rng: Rng, c: Color) => Color;
}

const UP = new Vector3(0, 1, 0);

function blocked(x: number, z: number, obstacles: readonly SphereObstacle[], margin: number): boolean {
  return obstacles.some((o) => {
    const dy = Math.max(0, o.center.y - o.radius - substrateHeight(x, z));
    return dy < 0.02 && (x - o.center.x) ** 2 + (z - o.center.z) ** 2 < (o.radius + margin) ** 2;
  });
}

/** Grows one species as a few InstancedMeshes (one per geometry variant). */
function plantSpecies(u: UnderwaterUniforms, species: Species, spots: Spot[], rng: Rng): Group {
  const group = new Group();
  group.name = species.name;
  const material = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: species.roughness, metalness: 0 });
  patchUnderwater(material, u, { translucency: species.translucency, sway: species.sway });
  const depthMaterial = species.castShadow ? createMotionDepthMaterial(u, { sway: species.sway }) : null;

  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const c = new Color();
  const buckets: Spot[][] = Array.from({ length: species.variants }, () => []);
  spots.forEach((spot, i) => buckets[i % species.variants].push(spot));

  for (const bucket of buckets) {
    if (bucket.length === 0) continue;
    const mesh = new InstancedMesh(species.build(rng), material, bucket.length);
    bucket.forEach((spot, i) => {
      q.setFromAxisAngle(UP, rng() * Math.PI * 2);
      s.setScalar(spot.scale);
      p.set(spot.x, substrateHeight(spot.x, spot.z) - 0.004, spot.z);
      mesh.setMatrixAt(i, m.compose(p, q, s));
      mesh.setColorAt(i, species.tint(rng, c));
    });
    mesh.receiveShadow = true;
    mesh.castShadow = species.castShadow;
    if (depthMaterial) mesh.customDepthMaterial = depthMaterial;
    // Instances span the tank; the default per-geometry bounds would cull them wrongly.
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}

/** Highest scale that keeps a plant of unit height below the surface at (x, z). */
function maxScale(x: number, z: number, clearance: number): number {
  return TANK.waterLevel - clearance - substrateHeight(x, z);
}

export function createPlants(u: UnderwaterUniforms, obstacles: readonly SphereObstacle[], q: QualitySettings): Group {
  const rng = mulberry32(1234);
  const group = new Group();
  group.name = 'plants';

  // Vallisneria: a dense curtain along the back glass, growing in runner clusters.
  const valSpots: Spot[] = [];
  while (valSpots.length < q.vallisneriaBlades) {
    const cx = range(rng, TANK.min.x + 0.03, TANK.max.x - 0.03);
    const cz = range(rng, TANK.min.z + 0.02, TANK.min.z + 0.1);
    for (let k = 0; k < 8 && valSpots.length < q.vallisneriaBlades; k++) {
      const x = cx + range(rng, -0.03, 0.03);
      const z = Math.max(TANK.min.z + 0.01, cz + range(rng, -0.02, 0.02));
      if (blocked(x, z, obstacles, 0.005)) continue;
      valSpots.push({ x, z, scale: Math.min(range(rng, 0.26, 0.42), maxScale(x, z, 0.025)) });
    }
  }
  group.add(
    plantSpecies(u, {
      name: 'vallisneria',
      variants: 4,
      build: vallisneriaBlade,
      sway: { amplitude: 0.07, height: 1 },
      translucency: 0.8,
      roughness: 0.45,
      castShadow: true,
      tint: (r, c) => c.setRGB(range(r, 0.8, 1.05), range(r, 0.9, 1.1), range(r, 0.7, 1.0)),
    }, valSpots, rng),
  );

  // Rotala bushes in the back corners and behind the main stone.
  const bushes = [
    { x: -0.5, z: -0.15, n: 0.3 },
    { x: 0.49, z: -0.14, n: 0.3 },
    { x: -0.36, z: -0.19, n: 0.2 },
    { x: 0.12, z: -0.2, n: 0.2 },
  ];
  const stemSpots: Spot[] = [];
  for (const bush of bushes) {
    const n = Math.round(q.stemPlants * bush.n);
    let placed = 0;
    for (let k = 0; k < n * 3 && placed < n; k++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 0.07;
      const x = bush.x + Math.cos(a) * r;
      const z = Math.min(TANK.max.z - 0.02, Math.max(TANK.min.z + 0.015, bush.z + Math.sin(a) * r * 0.7));
      if (blocked(x, z, obstacles, 0.004)) continue;
      const centre = 1 - r / 0.07;
      stemSpots.push({ x, z, scale: Math.min(range(rng, 0.17, 0.25) + centre * 0.1, maxScale(x, z, 0.03)) });
      placed++;
    }
  }
  group.add(
    plantSpecies(u, {
      name: 'rotala',
      variants: 5,
      build: stemPlant,
      sway: { amplitude: 0.03, height: 1 },
      translucency: 0.6,
      roughness: 0.5,
      castShadow: true,
      tint: (r, c) => c.setRGB(range(r, 0.85, 1.1), range(r, 0.85, 1.05), range(r, 0.8, 1.0)),
    }, stemSpots, rng),
  );

  // Hairgrass carpet in the foreground, thicker in patches, leaving a sandy path.
  const grassSpots: Spot[] = [];
  let attempts = 0;
  while (grassSpots.length < q.hairgrassTufts && attempts++ < q.hairgrassTufts * 20) {
    const x = range(rng, TANK.min.x + 0.01, TANK.max.x - 0.01);
    const z = range(rng, -0.12, TANK.max.z - 0.01);
    const density = 0.5 + 0.5 * Math.sin(x * 7.0 + 1.3) * Math.cos(z * 9.0 - 0.4);
    const path = Math.abs(x - 0.12 - Math.sin(z * 8.0) * 0.06) < 0.05 && z > 0.0;
    if (path || rng() > density + 0.15 || blocked(x, z, obstacles, 0.0)) continue;
    grassSpots.push({ x, z, scale: range(rng, 0.028, 0.05) * (0.7 + 0.5 * density) });
  }
  group.add(
    plantSpecies(u, {
      name: 'hairgrass',
      variants: 3,
      build: hairgrassTuft,
      sway: { amplitude: 0.006, height: 1 },
      translucency: 0.7,
      roughness: 0.5,
      castShadow: false,
      tint: (r, c) => c.setRGB(range(r, 0.85, 1.1), range(r, 0.9, 1.1), range(r, 0.8, 1.0)),
    }, grassSpots, rng),
  );

  return group;
}
