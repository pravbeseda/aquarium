import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3, type Texture } from 'three';
import { ROOM_PARS } from '../render/roomGlsl';
import { TANK } from '../sim/tank';
import type { WaterLook } from './environment';

const vertexShader = /* glsl */ `
uniform float uTime;
uniform vec3 uAgitation;
varying vec3 vWorld;

WAVES

void main() {
  vec4 world = modelMatrix * vec4( position, 1.0 );
  vec2 grad;
  world.y += waves( world.xz, uTime, grad );
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
WAVES

void main() {
  vec2 grad;
  waves( vWorld.xz, uTime, grad );
  vec3 n = normalize( vec3( -grad.x, 1.0, -grad.y ) );
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
  // Alpha above 1 carries the mirror fraction for the water pass, which traces the reflection.
  gl_FragColor = vec4( air, 1.0 + F );
}
`;

// Capillary-gravity wave trains plus ripples from the bubble column; returns height and its gradient.
const WAVES = /* glsl */ `
float waves( vec2 p, float t, out vec2 grad ) {
  const vec2 dirs[ 7 ] = vec2[]( vec2( 1.0, 0.2 ), vec2( -0.6, 1.0 ), vec2( 0.8, -0.7 ), vec2( -1.0, -0.35 ), vec2( 0.25, 1.0 ), vec2( 0.7, 0.55 ), vec2( -0.3, -1.0 ) );
  const float lens[ 7 ] = float[]( 0.23, 0.14, 0.09, 0.061, 0.038, 0.024, 0.016 );
  float h = 0.0;
  grad = vec2( 0.0 );
  for ( int i = 0; i < 7; i++ ) {
    vec2 d = normalize( dirs[ i ] );
    float k = 6.2831853 / lens[ i ];
    float w = sqrt( 9.81 * k + 7.4e-5 * k * k * k );
    float a = lens[ i ] * 0.0075;
    float ph = k * dot( d, p ) - w * t * 0.45 + float( i ) * 1.7;
    h += a * sin( ph );
    grad += a * k * d * cos( ph );
  }
  vec2 r = p - uAgitation.xy;
  float rl = length( r ) + 1e-4;
  float env = uAgitation.z * exp( -rl * 9.0 );
  float ph = rl * 140.0 - t * 14.0;
  h += env * sin( ph );
  grad += env * ( 140.0 * cos( ph ) - 9.0 * sin( ph ) ) * ( r / rl );
  return h;
}
`;

export function createWaterSurface(look: WaterLook, room: { texture: Texture; maxLod: number }, agitation: Vector2): Mesh {
  const width = TANK.max.x - TANK.min.x;
  const depth = TANK.max.z - TANK.min.z;
  const geometry = new PlaneGeometry(width, depth, 96, 40);
  geometry.rotateX(-Math.PI / 2);

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAgitation: { value: new Vector3(agitation.x, agitation.y, 0.0016) },
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
    vertexShader: vertexShader.replace('WAVES', WAVES),
    fragmentShader: fragmentShader.replace('WAVES', WAVES),
    side: DoubleSide,
  });

  const mesh = new Mesh(geometry, material);
  mesh.position.set((TANK.min.x + TANK.max.x) / 2, TANK.waterLevel, (TANK.min.z + TANK.max.z) / 2);
  mesh.name = 'water-surface';
  return mesh;
}
