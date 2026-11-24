import { DoubleSide, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshPhysicalMaterial, Vector3, type BufferGeometry } from 'three';
import { patchUnderwater, type UnderwaterUniforms } from '../../render/underwaterMaterial';
import type { FishTextures } from './fishTextures';

export interface FishLook {
  textures: FishTextures;
  body: BufferGeometry;
  fins: BufferGeometry;
  length: number;
  iridescence: number;
  roughness: number;
}

const m = new Matrix4();
const target = new Vector3();
const UP = new Vector3(0, 1, 0);
const heading = new Vector3();

/** Draws many fish of one species with two instanced meshes (opaque body, translucent fins) sharing a swim attribute. */
export class InstancedFish {
  readonly group = new Group();
  private readonly body: InstancedMesh;
  private readonly finMesh: InstancedMesh;
  private readonly swim: InstancedBufferAttribute;
  private readonly length: number;

  constructor(u: UnderwaterUniforms, look: FishLook, count: number) {
    this.length = look.length;
    this.swim = new InstancedBufferAttribute(new Float32Array(count * 2), 2);
    this.swim.setUsage(DynamicDrawUsage);
    look.body.setAttribute('aSwim', this.swim);
    look.fins.setAttribute('aSwim', this.swim);

    const bodyMaterial = new MeshPhysicalMaterial({
      map: look.textures.map,
      roughness: look.roughness,
      metalness: 0,
      iridescence: look.iridescence,
      iridescenceMap: look.textures.iridescence,
      iridescenceIOR: 1.8,
      iridescenceThicknessMinimum: 260,
      iridescenceThicknessMaximum: 520,
      emissiveMap: look.textures.emissive ?? null,
      emissive: look.textures.emissive ? 0xffffff : 0x000000,
      emissiveIntensity: 0.9,
      clearcoat: 0.3,
      clearcoatRoughness: 0.3,
    });
    patchUnderwater(bodyMaterial, u, { swim: true, translucency: 0.25 });

    const finMaterial = new MeshPhysicalMaterial({
      map: look.textures.fins,
      transparent: true,
      side: DoubleSide,
      roughness: 0.4,
      metalness: 0,
      // Fins write depth so the water pass fogs, blurs and mirrors them by their own distance.
      depthWrite: true,
    });
    patchUnderwater(finMaterial, u, { swim: true, translucency: 0.9 });

    this.body = new InstancedMesh(look.body, bodyMaterial, count);
    this.finMesh = new InstancedMesh(look.fins, finMaterial, count);
    for (const mesh of [this.body, this.finMesh]) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
    }
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.finMesh.renderOrder = 1;
    this.group.add(this.body, this.finMesh);
  }

  /** Places fish `i` facing along `direction`; the body is kept roughly level like a real fish. */
  set(i: number, position: Vector3, direction: Vector3, phase: number, amplitude: number, scale = 1): void {
    heading.copy(direction);
    heading.y = Math.max(-0.45, Math.min(0.45, heading.y));
    heading.normalize();
    target.copy(position).add(heading);
    m.lookAt(target, position, UP);
    m.scale(target.setScalar(this.length * scale));
    m.setPosition(position);
    this.body.setMatrixAt(i, m);
    this.finMesh.setMatrixAt(i, m);
    this.swim.setXY(i, phase, amplitude);
  }

  commit(): void {
    this.body.instanceMatrix.needsUpdate = true;
    this.finMesh.instanceMatrix.needsUpdate = true;
    this.swim.needsUpdate = true;
  }
}
