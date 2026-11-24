import { BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, Vector3 } from 'three';
import { mulberry32 } from '../core/random';
import type { UnderwaterUniforms } from '../render/underwaterMaterial';
import type { WaterLook } from './environment';
import { ADDITIVE_KEEP_ALPHA } from '../render/blending';

const BOX = 0.7;

const vertexShader = /* glsl */ `
uniform vec3 uCam;
uniform float uTime;
uniform float uPixelScale;
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;
uniform sampler2D tCaustics;
uniform float uCausticScale;
uniform vec3 uLightDirW;
attribute vec3 aSeed;
varying float vBright;
varying float vFade;

void main() {
  // Motes live in a box that follows the camera, wrapping around it.
  vec3 drift = vec3( 0.004, -0.0012, 0.0015 ) * uTime;
  vec3 p = mod( position + drift - uCam + ${(BOX / 2).toFixed(2)}, ${BOX.toFixed(2)} ) - ${(BOX / 2).toFixed(2)} + uCam;
  p += 0.004 * vec3( sin( uTime * 0.8 + aSeed.x * 40.0 ), sin( uTime * 0.6 + aSeed.y * 40.0 ), sin( uTime * 0.7 + aSeed.z * 40.0 ) );

  bool inside = all( greaterThan( p, uBoxMin ) ) && all( lessThan( p, uBoxMax ) );
  float lambda = max( ( p.y - uBoxMax.y ) / uLightDirW.y, 0.0 );
  vec2 entry = p.xz - uLightDirW.xz * lambda;
  float shaft = textureLod( tCaustics, entry * uCausticScale * 0.35, 3.0 ).g;
  vBright = 0.04 + shaft * 1.6;

  vec4 mv = viewMatrix * vec4( p, 1.0 );
  float dist = -mv.z;
  vFade = inside ? smoothstep( 0.015, 0.05, dist ) * ( 1.0 - smoothstep( 0.22, 0.34, dist ) ) : 0.0;
  float size = mix( 0.00025, 0.0009, aSeed.x * aSeed.x );
  float px = size * uPixelScale / max( dist, 1e-3 );
  vFade *= clamp( px, 0.0, 1.0 );
  gl_PointSize = max( px, 1.0 );
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
varying float vBright;
varying float vFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = 1.0 - smoothstep( 0.1, 0.5, length( c ) );
  gl_FragColor = vec4( vec3( 0.9, 0.95, 0.85 ) * vBright * vFade * a, 1.0 );
}
`;

/** Suspended particles: they sparkle in the light shafts and make movement readable. */
export class Particles {
  readonly points: Points;
  private readonly material: ShaderMaterial;

  constructor(u: UnderwaterUniforms, look: WaterLook, count: number) {
    const rng = mulberry32(3);
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = rng() * BOX;
      seeds[i] = rng();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 3));

    this.material = new ShaderMaterial({
      uniforms: {
        uCam: { value: new Vector3() },
        uTime: u.uTime,
        uPixelScale: { value: 800 },
        uBoxMin: { value: look.waterBoxMin },
        uBoxMax: { value: look.waterBoxMax },
        tCaustics: u.tCaustics,
        uCausticScale: u.uCausticScale,
        uLightDirW: u.uLightDirW,
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      ...ADDITIVE_KEEP_ALPHA,
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'particles';
  }

  update(camera: Vector3, pixelScale: number): void {
    this.material.uniforms.uCam.value.copy(camera);
    this.material.uniforms.uPixelScale.value = pixelScale;
  }
}
