import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector2, type Texture } from 'three';
import { ROOM_PARS } from '../render/roomGlsl';
import { WAVES_GLSL } from '../render/wavesGlsl';
import { TANK } from '../sim/tank';
import type { WaterLook } from './environment';

// The surface stays a flat plane, so the water pass can recognise it by height; the waves live in the normals.
const vertexShader = /* glsl */ `
varying vec3 vWorld;

void main() {
  vec4 world = modelMatrix * vec4( position, 1.0 );
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uAgitation;
uniform float uRoomLod;
uniform vec3 uLampCenter;
uniform vec2 uLampHalf;
uniform vec3 uLampRadiance;
varying vec3 vWorld;

${ROOM_PARS}
${WAVES_GLSL}

void main() {
  vec3 n = waveNormal( vWorld.xz, uTime, uAgitation );
  vec3 v = normalize( vWorld - cameraPosition );
  float cosI = max( dot( v, n ), 0.02 );
  float F = waterToAirFresnel( cosI );
  vec3 air = vec3( 0.0 );
  if ( F < 1.0 ) {
    vec3 t = refract( v, -n, 1.333 );
    air = sampleRoom( vWorld, t, uRoomLod );
    // The pendant lamp: a bright emitter inside a dark housing.
    float tl = ( uLampCenter.y - vWorld.y ) / max( t.y, 1e-3 );
    vec2 q = abs( vWorld.xz + t.xz * tl - uLampCenter.xz ) / uLampHalf;
    float box = max( q.x, q.y );
    float housing = 1.0 - smoothstep( 1.08, 1.16, box );
    float emitter = 1.0 - smoothstep( 0.9, 1.0, box );
    air = mix( air, vec3( 0.01 ), housing );
    air += uLampRadiance * emitter;
    air *= 1.0 - F;
  }
  // The reflected part (F) is added by the water pass, which can trace the tank's mirror image.
  gl_FragColor = vec4( air, 1.0 );
}
`;

export function createWaterSurface(look: WaterLook, room: { texture: Texture; maxLod: number }): Mesh {
  const width = TANK.max.x - TANK.min.x;
  const depth = TANK.max.z - TANK.min.z;
  const geometry = new PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAgitation: { value: look.surfaceAgitation },
      tRoom: { value: room.texture },
      uRoomRot: { value: look.roomRotation },
      uRoomCenter: { value: look.roomCenter },
      uRoomRadius: { value: look.roomRadius },
      uRoomIntensity: { value: look.roomIntensity },
      uRoomLod: { value: room.maxLod * 0.2 },
      uLampCenter: { value: look.lamp.center },
      uLampHalf: { value: new Vector2(...look.lamp.halfSize) },
      uLampRadiance: { value: look.lamp.radiance },
    },
    vertexShader,
    fragmentShader,
    side: DoubleSide,
  });

  const mesh = new Mesh(geometry, material);
  mesh.position.set((TANK.min.x + TANK.max.x) / 2, TANK.waterLevel, (TANK.min.z + TANK.max.z) / 2);
  mesh.name = 'water-surface';
  return mesh;
}
