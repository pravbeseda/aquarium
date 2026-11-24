import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { ADDITIVE_KEEP_ALPHA } from '../render/blending';
import { TANK, substrateHeight } from '../sim/tank';
import { patchUnderwater, type UnderwaterUniforms } from '../render/underwaterMaterial';
import { mulberry32, range } from '../core/random';


const vertexShader = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewDir;
varying float vDist;
void main() {
  vec4 world = modelMatrix * instanceMatrix * vec4( position, 1.0 );
  vec4 mv = viewMatrix * world;
  vNormalV = normalize( mat3( viewMatrix ) * mat3( modelMatrix ) * mat3( instanceMatrix ) * normal );
  vViewDir = normalize( -mv.xyz );
  vDist = length( mv.xyz );
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uLightDirV;
uniform vec3 uLampColor;
uniform vec3 uWaterTint;
varying vec3 vNormalV;
varying vec3 vViewDir;
varying float vDist;
void main() {
  vec3 n = normalize( vNormalV );
  float facing = abs( dot( n, vViewDir ) );
  // An air bubble in water is a mirror at its rim (total internal reflection) and nearly clear in the middle.
  float rim = pow( 1.0 - facing, 3.0 );
  vec3 h = normalize( -uLightDirV + vViewDir );
  float spec = pow( max( dot( n, h ), 0.0 ), 90.0 );
  float inner = pow( max( dot( n, -uLightDirV ), 0.0 ), 6.0 ) * 0.25;
  vec3 color = uWaterTint * rim * 1.6 + uLampColor * ( spec * 14.0 + inner );
  color *= exp( -vDist * 1.2 );
  gl_FragColor = vec4( color, 1.0 );
}
`;

const matrix = new Matrix4();

interface Bubble {
  position: Vector3;
  radius: number;
  speed: number;
  wobble: number;
  alive: boolean;
}

/** An air stone in the back corner with its airline, releasing a stream of wobbling bubbles. */
export class Bubbles {
  readonly group = new Group();
  private readonly bubbles: Bubble[] = [];
  private readonly mesh: InstancedMesh;
  private readonly material: ShaderMaterial;
  private readonly rng = mulberry32(77);
  private readonly origin: Vector3;
  private spawnDebt = 0;

  constructor(u: UnderwaterUniforms, lampColor: Color, aerator: Vector2) {
    const { x, y: z } = aerator;
    const floor = substrateHeight(x, z);
    this.origin = new Vector3(x, floor + 0.022, z);

    const stoneMaterial = new MeshStandardMaterial({ color: 0x8a8a86, roughness: 1 });
    patchUnderwater(stoneMaterial, u);
    const stone = new Mesh(new CylinderGeometry(0.011, 0.012, 0.026, 20), stoneMaterial);
    stone.position.set(x, floor + 0.008, z);
    stone.castShadow = true;
    stone.receiveShadow = true;

    const hoseMaterial = new MeshStandardMaterial({ color: 0xd8e6e0, roughness: 0.25, transparent: true, opacity: 0.55 });
    patchUnderwater(hoseMaterial, u);
    const path = new CatmullRomCurve3([
      new Vector3(x, floor + 0.02, z),
      new Vector3(x - 0.02, floor + 0.05, TANK.min.z + 0.01),
      new Vector3(TANK.min.x + 0.06, TANK.waterLevel - 0.1, TANK.min.z + 0.006),
      new Vector3(TANK.min.x + 0.05, TANK.max.y + 0.05, TANK.min.z + 0.006),
    ]);
    const hose = new Mesh(new TubeGeometry(path, 80, 0.0028, 8, false), hoseMaterial);
    this.group.add(stone, hose);

    this.material = new ShaderMaterial({
      uniforms: {
        uLightDirV: { value: new Vector3(0, -1, 0) },
        uLampColor: { value: lampColor.clone() },
        uWaterTint: { value: new Color(0.35, 0.5, 0.5) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      // Bubbles write depth so the distance blur and fog treat them by their own distance.
      depthWrite: true,
      ...ADDITIVE_KEEP_ALPHA,
    });
    const count = 140;
    this.mesh = new InstancedMesh(new SphereGeometry(1, 14, 10), this.material, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    for (let i = 0; i < count; i++) this.bubbles.push({ position: new Vector3(), radius: 0, speed: 0, wobble: 0, alive: false });
    this.group.add(this.mesh);
  }

  update(dt: number, time: number, lightDirView: Vector3): void {
    this.material.uniforms.uLightDirV.value.copy(lightDirView);
    this.spawnDebt += dt * 28;
    let n = 0;
    for (const b of this.bubbles) {
      if (!b.alive && this.spawnDebt >= 1) {
        this.spawnDebt -= 1;
        b.alive = true;
        b.position.copy(this.origin);
        b.position.x += range(this.rng, -0.005, 0.005);
        b.position.z += range(this.rng, -0.005, 0.005);
        b.radius = range(this.rng, 0.0008, 0.0026);
        b.speed = 0.12 + b.radius * 60;
        b.wobble = this.rng() * 10;
      }
      if (!b.alive) continue;
      b.position.y += b.speed * dt;
      b.wobble += dt * (9 + b.radius * 1500);
      const sway = b.radius * 1.4;
      b.position.x += Math.sin(b.wobble) * sway * dt * 9;
      b.position.z += Math.cos(b.wobble * 0.7) * sway * dt * 9;
      if (b.position.y > TANK.waterLevel - b.radius) {
        b.alive = false;
        continue;
      }
      const flatten = 1 - Math.min(0.25, b.radius * 90) * (0.6 + 0.4 * Math.sin(b.wobble * 2 + time));
      matrix.makeScale(b.radius, b.radius * flatten, b.radius).setPosition(b.position);
      this.mesh.setMatrixAt(n++, matrix);
    }
    this.spawnDebt = Math.min(this.spawnDebt, 2);
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
