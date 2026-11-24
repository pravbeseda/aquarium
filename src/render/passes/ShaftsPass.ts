import { HalfFloatType, ShaderMaterial, WebGLRenderTarget, type PerspectiveCamera, type Texture, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { HalfResBlur } from './HalfResBlur';
import { FULLSCREEN_VERTEX, VIEW_RAY_GLSL, updateViewRayUniforms, viewRayUniforms } from '../waterGlsl';
import type { WaterLook } from '../../world/environment';

const fragmentShader = /* glsl */ `
uniform sampler2D tCaustics;
uniform float uCausticScale;
uniform vec3 uLightDirW;
uniform vec3 uLightColor;
uniform float uShaftIntensity;
uniform vec3 uExtinction;
uniform float uTime;
uniform float uFrame;
varying vec2 vUv;

${VIEW_RAY_GLSL}

float hash12( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}

float valueNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash12( i ), hash12( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash12( i + vec2( 0.0, 1.0 ) ), hash12( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}

// March the view ray and look up how much focused light enters at the surface above each point.
// A slowly drifting sparse mask picks out a few bright columns; the caustics make them shimmer.
void main() {
  float depth = texture2D( tDepth, vUv ).r;
  vec3 dir = viewRay( vUv );
  float dist = visibleDistance( vUv, depth, dir );

  float maxT = min( dist, 1.4 );
  float stepLen = maxT / float( SHAFT_STEPS );
  float jitter = hash12( gl_FragCoord.xy + uFrame * 17.31 );
  vec3 acc = vec3( 0.0 );
  for ( int i = 0; i < SHAFT_STEPS; i++ ) {
    float t = ( float( i ) + jitter ) * stepLen;
    vec3 p = uCamPos + dir * t;
    float lambda = max( ( p.y - uBoxMax.y ) / uLightDirW.y, 0.0 );
    vec2 entry = p.xz - uLightDirW.xz * lambda;
    float mask = valueNoise( entry * 19.0 + vec2( uTime * 0.07, -uTime * 0.05 ) ) * 0.65 + valueNoise( entry * 47.0 - uTime * 0.11 ) * 0.35;
    mask = smoothstep( 0.6, 0.92, mask );
    float shimmer = 0.4 + textureLod( tCaustics, entry * uCausticScale * 0.3, 2.0 + lambda * 2.0 ).g * 1.6;
    acc += mask * shimmer * exp( -uExtinction * ( t + lambda ) );
  }
  float cosTheta = dot( uLightDirW, -dir );
  const float g = 0.35;
  float phase = ( 1.0 - g * g ) / pow( 1.0 + g * g - 2.0 * g * cosTheta, 1.5 );
  gl_FragColor = vec4( acc * stepLen * phase * uLightColor * uShaftIntensity, 1.0 );
}
`;

/** Volumetric light shafts, ray-marched at half resolution and blurred to hide the sampling noise. */
export class ShaftsPass {
  private readonly raw = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
  private readonly blur = new HalfResBlur();
  private readonly material: ShaderMaterial;
  private readonly quad: FullScreenQuad;

  constructor(look: WaterLook, steps: number) {
    this.material = new ShaderMaterial({
      defines: { SHAFT_STEPS: steps },
      uniforms: {
        ...viewRayUniforms(look),
        tCaustics: { value: null },
        uCausticScale: { value: look.causticScale },
        uLightDirW: { value: look.lightDir },
        uLightColor: { value: look.shaftColor },
        uShaftIntensity: { value: look.shaftIntensity },
        uExtinction: { value: look.extinction },
        uTime: { value: 0 },
        uFrame: { value: 0 },
      },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  /** Blurred shafts, half resolution. */
  get target(): WebGLRenderTarget {
    return this.blur.target;
  }

  setSize(width: number, height: number): void {
    this.raw.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
    this.blur.setSize(width, height);
  }

  render(renderer: WebGLRenderer, camera: PerspectiveCamera, depth: Texture, caustics: Texture, time: number, frame: number): void {
    const u = this.material.uniforms;
    updateViewRayUniforms(u, camera, depth);
    u.tCaustics.value = caustics;
    u.uTime.value = time;
    u.uFrame.value = frame % 64;

    renderer.setRenderTarget(this.raw);
    this.quad.render(renderer);
    this.blur.render(renderer, this.raw.texture);
  }
}
