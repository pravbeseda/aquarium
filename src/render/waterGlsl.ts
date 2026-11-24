import { Matrix4, Vector3, type IUniform, type PerspectiveCamera, type Texture } from 'three';
import type { WaterLook } from '../world/environment';

export const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

/** Reconstructs view rays from the depth buffer and finds where a ray leaves the water through the glass. */
export const VIEW_RAY_GLSL = /* glsl */ `
uniform sampler2D tDepth;
uniform mat4 uProjInv;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;

vec3 viewPosition( vec2 uv, float depth ) {
  vec4 v = uProjInv * vec4( uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );
  return v.xyz / v.w;
}

vec3 viewRay( vec2 uv ) {
  return normalize( mat3( uCamWorld ) * viewPosition( uv, 1.0 ) );
}

// Distance from the camera to the water box wall along dir, and that wall's outward normal.
float exitWater( vec3 dir, out vec3 normal ) {
  vec3 inv = 1.0 / dir;
  vec3 tFar = max( ( uBoxMin - uCamPos ) * inv, ( uBoxMax - uCamPos ) * inv );
  float t = max( min( min( tFar.x, tFar.y ), tFar.z ), 0.0 );
  normal = t == tFar.x ? vec3( sign( dir.x ), 0.0, 0.0 ) : ( t == tFar.y ? vec3( 0.0, sign( dir.y ), 0.0 ) : vec3( 0.0, 0.0, sign( dir.z ) ) );
  return t;
}
`;

export function viewRayUniforms(look: WaterLook) {
  return {
    tDepth: { value: null as Texture | null },
    uProjInv: { value: new Matrix4() },
    uCamWorld: { value: new Matrix4() },
    uCamPos: { value: new Vector3() },
    uBoxMin: { value: look.waterBoxMin.clone() },
    uBoxMax: { value: look.waterBoxMax.clone() },
  };
}

export function updateViewRayUniforms(u: Record<string, IUniform>, camera: PerspectiveCamera, depth: Texture): void {
  u.tDepth.value = depth;
  u.uProjInv.value.copy(camera.projectionMatrixInverse);
  u.uCamWorld.value.copy(camera.matrixWorld);
  u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
}
