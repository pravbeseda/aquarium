import { Matrix4, ShaderMaterial, type DepthTexture, type PerspectiveCamera, type Texture, type WebGLRenderer, type WebGLRenderTarget } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { ROOM_PARS } from '../roomGlsl';
import { FULLSCREEN_VERTEX, VIEW_RAY_GLSL, updateViewRayUniforms, viewRayUniforms } from '../waterGlsl';
import type { WaterLook } from '../../world/environment';

const fragmentShader = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tShafts;
uniform mat4 uViewProj;
uniform float uGlassTop;
uniform vec3 uExtinction;
uniform vec3 uWaterDeep;
uniform vec3 uWaterShallow;
uniform vec3 uLightDirW;
uniform float uRoomLod;
uniform float uTime;
varying vec2 vUv;

${VIEW_RAY_GLSL}
${ROOM_PARS}

// Ambient light scattered by the water itself: brighter towards the surface and the lamp.
vec3 waterColor( vec3 dir, float y ) {
  float up = smoothstep( -0.7, 0.95, dir.y );
  float depthFactor = 0.6 + 0.4 * clamp( y / uBoxMax.y, 0.0, 1.0 );
  float towardsLamp = pow( max( dot( -uLightDirW, dir ), 0.0 ), 8.0 );
  return ( mix( uWaterDeep, uWaterShallow, up ) + uWaterShallow * towardsLamp * 0.5 ) * depthFactor;
}

vec3 throughWater( vec3 color, float dist, vec3 dir, float y ) {
  vec3 T = exp( -uExtinction * dist );
  return color * T + waterColor( dir, y ) * ( 1.0 - T );
}

vec2 projectToScreen( vec3 x ) {
  vec4 clip = uViewProj * vec4( x, 1.0 );
  return clip.w > 0.0 ? clip.xy / clip.w * 0.5 + 0.5 : vec2( -1.0 );
}

// How far behind the visible surface a point is, or a negative value when it is in front of it.
float behindScene( vec3 x, vec2 uv ) {
  float d = texture2D( tDepth, uv ).r;
  if ( d >= 0.99999 ) return -1.0;
  return distance( x, uCamPos ) - length( viewPosition( uv, d ) );
}

// Screen-space trace of a reflected ray (mirror-like glass, underside of the surface).
// Falls back to the water colour when the reflected point is off screen or the hit is doubtful.
vec3 traceReflection( vec3 origin, vec3 dir ) {
  vec3 fallback = waterColor( dir, origin.y );
  float prev = 0.0;
  float s = 0.01;
  for ( int i = 0; i < 18; i++ ) {
    vec2 uv = projectToScreen( origin + dir * s );
    if ( uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) break;
    float behind = behindScene( origin + dir * s, uv );
    if ( behind > 0.0 ) {
      // Refine between the last point in front and this one.
      float lo = prev;
      float hi = s;
      for ( int j = 0; j < 5; j++ ) {
        float mid = 0.5 * ( lo + hi );
        vec2 muv = projectToScreen( origin + dir * mid );
        if ( behindScene( origin + dir * mid, muv ) > 0.0 ) hi = mid; else lo = mid;
      }
      vec3 hit = origin + dir * hi;
      vec2 huv = projectToScreen( hit );
      float thickness = behindScene( hit, huv );
      float confidence = ( 1.0 - smoothstep( 0.004, 0.02 + hi * 0.03, thickness ) );
      vec2 edge = min( huv, 1.0 - huv );
      confidence *= smoothstep( 0.0, 0.08, min( edge.x, edge.y ) );
      vec3 c = throughWater( texture2D( tColor, huv ).rgb, hi, dir, hit.y );
      return mix( fallback, c, confidence );
    }
    prev = s;
    s *= 1.28;
  }
  return fallback;
}

// What is seen where a ray leaves through the glass: the room (refracted) or a mirror image (TIR).
vec3 glass( vec3 p, vec3 dir, vec3 n ) {
  float cosI = dot( dir, n );
  float F = min( waterToAirFresnel( cosI ) + 0.03, 1.0 );
  vec3 color = vec3( 0.0 );
  if ( F < 1.0 ) {
    vec3 refracted = refract( dir, -n, 1.333 );
    color = sampleRoom( p, refracted, uRoomLod ) * ( 1.0 - F );
  }
  color += traceReflection( p, reflect( dir, n ) ) * F;

  // Black silicone seams and the green edge of the glass panes at the corners.
  vec3 lo = p - vec3( uBoxMin.x, 0.0, uBoxMin.z );
  vec3 hi = vec3( uBoxMax.x, uGlassTop, uBoxMax.z ) - p;
  float edge = abs( n.x ) > 0.5 ? min( lo.z, hi.z ) : ( abs( n.z ) > 0.5 ? min( lo.x, hi.x ) : 1.0 );
  float seam = 1.0 - smoothstep( 0.0035, 0.006, edge );
  float paneEdge = 1.0 - smoothstep( 0.006, 0.012, edge );
  color = mix( color, color * vec3( 0.45, 0.8, 0.7 ), paneEdge * 0.8 );
  color = mix( color, vec3( 0.012, 0.014, 0.013 ), seam );

  // Faint smudges and limescale on the glass catch the room light.
  vec2 g = abs( n.x ) > 0.5 ? p.zy : p.xy;
  float smudge = smoothstep( 0.55, 0.95, sin( g.x * 37.0 + sin( g.y * 23.0 ) * 1.7 ) * sin( g.y * 29.0 - g.x * 11.0 ) );
  color += smudge * 0.012 * ( 1.0 - F );
  return color;
}

void main() {
  vec4 src = texture2D( tColor, vUv );
  float depth = texture2D( tDepth, vUv ).r;
  vec3 dir = viewRay( vUv );
  vec3 color;
  float dist;

  if ( depth >= 0.99999 ) {
    vec3 n;
    dist = exitWater( dir, n );
    color = glass( uCamPos + dir * dist, dir, n );
  } else {
    dist = length( viewPosition( vUv, depth ) );
    color = src.rgb;
    // The water surface encodes its reflectance in alpha (1 - 0.5 * F).
    float mirror = clamp( ( 1.0 - src.a ) * 2.0, 0.0, 1.0 );
    if ( mirror > 0.002 ) {
      vec3 p = uCamPos + dir * dist;
      vec2 w = vec2( sin( p.x * 41.0 + uTime * 1.3 ) + sin( p.z * 57.0 - uTime * 1.7 ), cos( p.z * 43.0 + uTime * 1.1 ) + sin( p.x * 31.0 + uTime ) );
      vec3 n = normalize( vec3( w.x * 0.03, -1.0, w.y * 0.03 ) );
      color += traceReflection( p, reflect( dir, n ) ) * mirror;
    }
  }

  color = throughWater( color, dist, dir, uCamPos.y );
  color += texture2D( tShafts, vUv ).rgb;
  gl_FragColor = vec4( color, 1.0 );
}
`;

export interface WaterPassInputs {
  color: Texture;
  depth: DepthTexture;
  shafts: Texture;
  room: Texture;
  roomMaxLod: number;
}

/** Turns the raw lit scene into "seen through water": absorption, scattering, glass and the room behind it, plus the light shafts. */
export class WaterPass {
  readonly material: ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private readonly viewProj = new Matrix4();

  constructor(look: WaterLook) {
    this.material = new ShaderMaterial({
      uniforms: {
        ...viewRayUniforms(look),
        tColor: { value: null },
        tShafts: { value: null },
        tRoom: { value: null },
        uViewProj: { value: new Matrix4() },
        uGlassTop: { value: look.glassTop },
        uExtinction: { value: look.extinction },
        uWaterDeep: { value: look.deepColor },
        uWaterShallow: { value: look.shallowColor },
        uLightDirW: { value: look.lightDir },
        uRoomRot: { value: look.roomRotation },
        uRoomCenter: { value: look.roomCenter },
        uRoomRadius: { value: look.roomRadius },
        uRoomIntensity: { value: look.roomIntensity },
        uRoomLod: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer: WebGLRenderer, camera: PerspectiveCamera, inputs: WaterPassInputs, target: WebGLRenderTarget, time: number, roomBlur: number): void {
    const u = this.material.uniforms;
    updateViewRayUniforms(u, camera, inputs.depth);
    u.tColor.value = inputs.color;
    u.tShafts.value = inputs.shafts;
    u.tRoom.value = inputs.room;
    u.uRoomLod.value = inputs.roomMaxLod * roomBlur;
    u.uViewProj.value.copy(this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    u.uTime.value = time;

    renderer.setRenderTarget(target);
    this.quad.render(renderer);
  }
}
