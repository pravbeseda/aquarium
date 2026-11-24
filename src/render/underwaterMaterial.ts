import { MeshDepthMaterial, ShaderChunk, Vector3, type Material, type Texture, type WebGLProgramParametersWithUniforms } from 'three';
import { insertAfter, insertBefore, replaceInclude } from './shaderPatch';

/** Uniforms shared by every underwater material; updating a value here updates all of them. */
export interface UnderwaterUniforms {
  [name: string]: { value: unknown };
  tCaustics: { value: Texture | null };
  uCausticScale: { value: number };
  uCausticStrength: { value: number };
  /** Direction the lamp light travels in world space (pointing down). */
  uLightDirW: { value: Vector3 };
  uWaterLevel: { value: number };
  uExtinction: { value: Vector3 };
  uTime: { value: number };
  uCurrentDir: { value: Vector3 };
  uPlayerPos: { value: Vector3 };
}

export function createUnderwaterUniforms(waterLevel: number, extinction: Vector3, lightDir: Vector3): UnderwaterUniforms {
  return {
    tCaustics: { value: null },
    uCausticScale: { value: 4 },
    uCausticStrength: { value: 4 },
    uLightDirW: { value: lightDir.clone().normalize() },
    uWaterLevel: { value: waterLevel },
    uExtinction: { value: extinction.clone() },
    uTime: { value: 0 },
    uCurrentDir: { value: new Vector3(1, 0, 0.35).normalize() },
    uPlayerPos: { value: new Vector3(0, -10, 0) },
  };
}

const DIRECT_LIGHT_ANCHOR = 'getDirectionalLightInfo( directionalLight, directLight );';

/** Text the patches rely on inside three.js shader chunks; verified by a unit test on upgrade. */
export const CHUNK_ANCHORS: ReadonlyArray<readonly [string, string]> = [['lights_fragment_begin', DIRECT_LIGHT_ANCHOR]];

export const PROGRAM_ANCHORS = {
  vertex: ['#include <common>', '#include <begin_vertex>', '#include <project_vertex>'],
  fragment: ['#include <common>', '#include <lights_fragment_begin>'],
} as const;

export interface UnderwaterOptions {
  /** Strength of light shining through thin leaves and fins from behind. */
  translucency?: number;
  /** Bend instanced plants (geometry one unit tall) with the current and away from the player: tip displacement in metres. */
  sway?: number;
  /** Undulate instanced fish; needs an instanced `aSwim` (phase, amplitude) attribute. */
  swim?: boolean;
}

const SWAY_PARS = /* glsl */ `
uniform float uTime;
uniform vec3 uCurrentDir;
uniform vec3 uPlayerPos;
uniform float uSwayAmp;
`;

// Bends an instanced plant in world space, then maps the offset back to local space.
// Instances are only rotated about Y and scaled uniformly, so transpose(M) / s^2 inverts M.
const SWAY_VERTEX = /* glsl */ `
#ifdef USE_INSTANCING
{
  float h = clamp( position.y, 0.0, 1.0 );
  mat3 im = mat3( instanceMatrix );
  float sc2 = dot( im[ 0 ], im[ 0 ] );
  vec3 root = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
  vec3 wp = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
  float ph = dot( root.xz, vec2( 9.1, 6.7 ) );
  float gust = 0.6 + 0.4 * sin( uTime * 0.29 + root.x * 3.0 + root.z * 1.3 );
  vec3 side = normalize( cross( uCurrentDir, vec3( 0.0, 1.0, 0.0 ) ) );
  vec3 offs = uCurrentDir * ( 0.45 + 0.55 * sin( uTime * 0.83 + ph - h * 1.9 ) ) * gust
            + side * 0.35 * sin( uTime * 1.37 + ph * 1.3 - h * 2.6 );
  offs *= uSwayAmp;
  vec3 away = wp - uPlayerPos;
  float worldHeight = sqrt( sc2 );
  float push = 1.0 - smoothstep( 0.012, 0.075, length( away ) );
  offs += normalize( vec3( away.x, 0.0, away.z ) + 1e-5 ) * push * min( 0.05, worldHeight * 0.7 );
  offs *= h * h;
  offs.y -= length( offs.xz ) * 0.4 * h;
  transformed += ( transpose( im ) * offs ) / sc2;
}
#endif
`;

// Fish geometry runs nose (+Z) to tail (-Z) over one unit; the wave travels towards the tail.
const SWIM_PARS = /* glsl */ `
#ifdef USE_INSTANCING
attribute vec2 aSwim;
#endif
`;

const SWIM_VERTEX = /* glsl */ `
#ifdef USE_INSTANCING
{
  float s = clamp( 0.5 - position.z, 0.0, 1.0 );
  float k = max( s - 0.22, 0.0 );
  transformed.x += aSwim.y * ( k * k * sin( aSwim.x - s * 5.5 ) + 0.035 * sin( aSwim.x + 1.2 ) );
}
#endif
`;

const CAUSTIC_VERTEX_PARS = /* glsl */ `
varying vec3 vUwWorldPos;
`;

const CAUSTIC_VERTEX = /* glsl */ `
{
  vec4 uwW = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
  uwW = instanceMatrix * uwW;
  #endif
  vUwWorldPos = ( modelMatrix * uwW ).xyz;
}
`;

const CAUSTIC_FRAGMENT_PARS = /* glsl */ `
varying vec3 vUwWorldPos;
uniform sampler2D tCaustics;
uniform float uCausticScale;
uniform float uCausticStrength;
uniform vec3 uLightDirW;
uniform float uWaterLevel;
uniform vec3 uExtinction;
`;

// Lamp light reaching this point: focused by the waves into caustics and attenuated by the water above.
const CAUSTIC_FRAGMENT = /* glsl */ `
vec3 uwLight;
{
  float lambda = max( ( vUwWorldPos.y - uWaterLevel ) / uLightDirW.y, 0.0 );
  vec2 entry = vUwWorldPos.xz - uLightDirW.xz * lambda;
  vec3 c = texture2D( tCaustics, entry * uCausticScale ).rgb;
  uwLight = ( 0.3 + c * uCausticStrength ) * exp( -uExtinction * lambda );
}
`;

const DIRECT_LIGHT_PATCH = /* glsl */ `
		directLight.color *= uwLight;
		#ifdef UW_TRANSLUCENCY
		reflectedLight.directDiffuse += material.diffuseColor * directLight.color * max( dot( -geometryNormal, directLight.direction ), 0.0 ) * UW_TRANSLUCENCY;
		#endif
`;

function swayUniforms(amplitude: number) {
  return { uSwayAmp: { value: amplitude } };
}

function patchVertexMotion(vertexShader: string, opts: UnderwaterOptions): string {
  let vs = vertexShader;
  if (opts.sway !== undefined) {
    vs = insertAfter(vs, '#include <common>', SWAY_PARS);
    vs = insertAfter(vs, '#include <begin_vertex>', SWAY_VERTEX);
  }
  if (opts.swim) {
    vs = insertAfter(vs, '#include <common>', SWIM_PARS);
    vs = insertAfter(vs, '#include <begin_vertex>', SWIM_VERTEX);
  }
  return vs;
}

/** Adds caustic lighting, optional translucency and optional vertex motion to a lit three.js material. */
export function patchUnderwater(material: Material, u: UnderwaterUniforms, opts: UnderwaterOptions = {}): void {
  const extra = opts.sway !== undefined ? swayUniforms(opts.sway) : {};
  const key = `uw:${opts.translucency ?? 0}:${opts.sway !== undefined ? 1 : 0}:${opts.swim ? 1 : 0}`;

  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, u, extra);

    let vs = patchVertexMotion(shader.vertexShader, opts);
    vs = insertAfter(vs, '#include <common>', CAUSTIC_VERTEX_PARS);
    vs = insertAfter(vs, '#include <project_vertex>', CAUSTIC_VERTEX);
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    if (opts.translucency) fs = `#define UW_TRANSLUCENCY ${opts.translucency.toFixed(3)}\n${fs}`;
    fs = insertAfter(fs, '#include <common>', CAUSTIC_FRAGMENT_PARS);
    fs = insertBefore(fs, '#include <lights_fragment_begin>', CAUSTIC_FRAGMENT);
    fs = replaceInclude(fs, 'lights_fragment_begin', insertAfter(ShaderChunk.lights_fragment_begin, DIRECT_LIGHT_ANCHOR, DIRECT_LIGHT_PATCH));
    shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () => key;
}

/** Shadow-pass material that bends with the same motion as the visible plant or fish. */
export function createMotionDepthMaterial(u: UnderwaterUniforms, opts: UnderwaterOptions): MeshDepthMaterial {
  const material = new MeshDepthMaterial();
  const extra = opts.sway !== undefined ? swayUniforms(opts.sway) : {};
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, u, extra);
    shader.vertexShader = patchVertexMotion(shader.vertexShader, opts);
  };
  material.customProgramCacheKey = () => `uw-depth:${opts.sway !== undefined ? 1 : 0}:${opts.swim ? 1 : 0}`;
  return material;
}
