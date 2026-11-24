import { BufferAttribute, Color, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { TANK, substrateHeight } from '../sim/tank';
import { patchUnderwater, type UnderwaterUniforms } from '../render/underwaterMaterial';
import type { PbrTextures } from './assets';

/** Grain size of the gravel: one texture tile covers this many metres. */
const TILE = 0.13;

export function createSubstrate(u: UnderwaterUniforms, tex: PbrTextures): Mesh {
  const width = TANK.max.x - TANK.min.x;
  const depth = TANK.max.z - TANK.min.z;
  const geometry = new PlaneGeometry(width, depth, 240, 100);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, substrateHeight(x, z));
    // Large-scale tint variation hides texture tiling: darker soil under the planted back, lighter sand in front.
    const back = (TANK.max.z - z) / depth;
    const patch = 0.5 + 0.5 * Math.sin(x * 9.0 + Math.sin(z * 13.0) * 2.0) * Math.cos(z * 11.0 - x * 4.0);
    const v = 0.95 - 0.3 * back + 0.12 * (patch - 0.5);
    c.setRGB(v, v * 0.97, v * 0.9);
    c.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  for (const t of [tex.map, tex.normalMap, tex.arm]) t.repeat.set(width / TILE, depth / TILE);

  const material = new MeshStandardMaterial({
    map: tex.map,
    normalMap: tex.normalMap,
    aoMap: tex.arm,
    roughnessMap: tex.arm,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
  });
  patchUnderwater(material, u);

  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'substrate';
  return mesh;
}
