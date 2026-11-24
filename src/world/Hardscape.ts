import { Box3, CatmullRomCurve3, Color, FrontSide, Group, Mesh, MeshStandardMaterial, TubeGeometry, Vector3, type BufferGeometry } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TANK, substrateHeight, type SphereObstacle } from '../sim/tank';
import { patchUnderwater, type UnderwaterUniforms } from '../render/underwaterMaterial';
import { mulberry32, range, type Rng } from '../core/random';
import type { PbrTextures } from './assets';

interface RockPlacement {
  node: string;
  x: number;
  z: number;
  scale: number;
  rotation: [number, number, number];
  sink: number;
}

// An iwagumi-like group: one main stone, two companions and a few small ones.
const ROCKS: RockPlacement[] = [
  { node: 'rock_moss_set_01_rock01', x: -0.29, z: -0.07, scale: 0.082, rotation: [-1.05, 0.5, 0.15], sink: 0.35 },
  { node: 'rock_moss_set_01_rock02', x: -0.13, z: 0.02, scale: 0.048, rotation: [-0.4, 2.1, 0.1], sink: 0.4 },
  { node: 'rock_moss_set_01_rock06', x: 0.25, z: -0.13, scale: 0.07, rotation: [-0.9, -0.7, -0.1], sink: 0.35 },
  { node: 'rock_moss_set_01_rock04', x: 0.4, z: 0.03, scale: 0.034, rotation: [0.1, 1.2, 0.0], sink: 0.45 },
  { node: 'rock_moss_set_01_rock05', x: 0.06, z: 0.06, scale: 0.026, rotation: [0.0, -0.4, 0.2], sink: 0.45 },
  { node: 'rock_moss_set_01_rock03', x: -0.45, z: 0.1, scale: 0.024, rotation: [0.2, 0.9, 0.0], sink: 0.5 },
];

export interface Hardscape {
  group: Group;
  obstacles: SphereObstacle[];
}

export function createHardscape(u: UnderwaterUniforms, rocks: GLTF, bark: PbrTextures): Hardscape {
  const group = new Group();
  group.name = 'hardscape';
  const obstacles: SphereObstacle[] = [];

  for (const r of ROCKS) {
    const source = rocks.scene.getObjectByName(r.node);
    if (!(source instanceof Mesh)) throw new Error(`Rock ${r.node} missing from the model`);
    const rock = new Mesh(source.geometry, source.material);
    rock.rotation.set(...r.rotation);
    rock.scale.setScalar(r.scale);
    rock.updateMatrixWorld();
    const box = new Box3().setFromObject(rock);
    const size = box.getSize(new Vector3());
    rock.position.set(r.x, substrateHeight(r.x, r.z) - box.min.y - size.y * r.sink, r.z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);

    rock.updateMatrixWorld();
    const center = new Box3().setFromObject(rock).getCenter(new Vector3());
    obstacles.push({ center, radius: Math.min(size.x, size.y, size.z) * 0.5 + Math.max(size.x, size.z) * 0.12 });
  }
  for (const m of new Set(group.children.map((c) => (c as Mesh).material as MeshStandardMaterial))) {
    m.side = FrontSide; // the scans are closed meshes
    patchUnderwater(m, u);
  }

  const wood = createDriftwood(u, bark, mulberry32(42));
  group.add(wood.mesh);
  obstacles.push(...wood.obstacles);
  return { group, obstacles };
}

interface Branch {
  points: Vector3[];
  radius0: number;
  radius1: number;
}

const BARK_TILE = 0.07;

/** Spider-wood: a few gnarled branches arching up from one base, splitting into twigs towards the light. */
function createDriftwood(u: UnderwaterUniforms, bark: PbrTextures, rng: Rng): { mesh: Mesh; obstacles: SphereObstacle[] } {
  const branches: Branch[] = [];
  const base = new Vector3(0.03, substrateHeight(0.03, -0.07) - 0.01, -0.07);

  const grow = (start: Vector3, dir: Vector3, length: number, radius: number, depth: number) => {
    const points = [start.clone()];
    const d = dir.clone().normalize();
    const p = start.clone();
    const step = 0.02;
    const steps = Math.max(3, Math.round(length / step));
    for (let i = 0; i < steps; i++) {
      d.x += range(rng, -0.3, 0.3);
      d.y += range(rng, -0.15, 0.25);
      d.z += range(rng, -0.3, 0.3);
      // Stay inside the glass and below the surface.
      if (p.y > TANK.waterLevel - 0.08) d.y -= 0.5;
      if (p.x < TANK.min.x + 0.08) d.x += 0.5;
      if (p.x > TANK.max.x - 0.08) d.x -= 0.5;
      if (p.z < TANK.min.z + 0.05) d.z += 0.5;
      if (p.z > TANK.max.z - 0.08) d.z -= 0.5;
      d.normalize();
      p.addScaledVector(d, step);
      points.push(p.clone());
    }
    const end = radius * range(rng, 0.25, 0.45);
    branches.push({ points, radius0: radius, radius1: end });

    if (depth >= 3) return;
    const children = depth === 0 ? 3 : 2;
    for (let c = 0; c < children; c++) {
      if (rng() > 0.85) continue;
      const at = Math.floor(points.length * range(rng, 0.35, 0.85));
      const t = at / (points.length - 1);
      const r = radius + (end - radius) * t;
      const childDir = points[Math.min(at + 1, points.length - 1)].clone().sub(points[at]).normalize();
      childDir.add(new Vector3(range(rng, -0.9, 0.9), range(rng, 0.1, 0.7), range(rng, -0.9, 0.9))).normalize();
      grow(points[at], childDir, length * range(rng, 0.45, 0.7), r * 0.75, depth + 1);
    }
  };

  grow(base, new Vector3(-0.8, 0.9, 0.2), 0.36, 0.017, 0);
  grow(base, new Vector3(0.7, 1.0, -0.1), 0.4, 0.016, 0);
  grow(base, new Vector3(0.1, 0.8, -0.6), 0.3, 0.013, 1);
  grow(base, new Vector3(0.2, 0.25, 0.9), 0.18, 0.012, 2);

  const geometries: BufferGeometry[] = [];
  const obstacles: SphereObstacle[] = [];
  for (const b of branches) {
    const curve = new CatmullRomCurve3(b.points);
    const length = curve.getLength();
    const tubular = Math.max(6, Math.round(length / 0.006));
    const radial = b.radius0 > 0.008 ? 10 : 6;
    const geo = new TubeGeometry(curve, tubular, 1, radial, false);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const center = new Vector3();
    const v = new Vector3();
    for (let i = 0; i <= tubular; i++) {
      const t = i / tubular;
      curve.getPointAt(t, center);
      const knot = 1 + 0.18 * Math.sin(t * length * 140 + b.radius0 * 900) * Math.sin(t * length * 37);
      const r = (b.radius0 + (b.radius1 - b.radius0) * t) * knot;
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        v.fromBufferAttribute(pos, k).sub(center).multiplyScalar(r).add(center);
        pos.setXYZ(k, v.x, v.y, v.z);
        uv.setXY(k, (t * length) / BARK_TILE, uv.getY(k) * Math.max(0.25, (2 * Math.PI * r) / BARK_TILE));
      }
    }
    geo.computeVertexNormals();
    geometries.push(geo);

    if (b.radius0 > 0.005) {
      for (let i = 0; i < b.points.length; i += 2) {
        const t = i / (b.points.length - 1);
        obstacles.push({ center: b.points[i].clone(), radius: (b.radius0 + (b.radius1 - b.radius0) * t) + 0.004 });
      }
    }
  }

  const material = new MeshStandardMaterial({
    map: bark.map,
    normalMap: bark.normalMap,
    aoMap: bark.arm,
    roughnessMap: bark.arm,
    roughness: 1,
    metalness: 0,
    color: new Color(0.95, 0.85, 0.75),
  });
  patchUnderwater(material, u);

  const mesh = new Mesh(mergeGeometries(geometries), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'driftwood';
  return { mesh, obstacles };
}
