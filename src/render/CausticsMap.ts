import { LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, ShaderMaterial, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { FULLSCREEN_VERTEX } from './waterGlsl';

// Tileable animated caustics after joltz0r / Dave Hoskins; RGB taps are offset for a hint of dispersion.
const fragmentShader = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
#define TAU 6.28318530718

float caustic( vec2 uv, float time ) {
  vec2 p = mod( uv * TAU, TAU ) - 250.0;
  vec2 i = p;
  float c = 1.0;
  const float inten = 0.005;
  for ( int n = 0; n < 5; n++ ) {
    float t = time * ( 1.0 - ( 3.5 / float( n + 1 ) ) );
    i = p + vec2( cos( t - i.x ) + sin( t + i.y ), sin( t - i.y ) + cos( t + i.x ) );
    // A constant numerator instead of p keeps the pattern exactly periodic.
    c += 1.0 / length( vec2( -247.0 / ( sin( i.x + t ) / inten ), -247.0 / ( cos( i.y + t ) / inten ) ) );
  }
  c /= 5.0;
  c = 1.17 - pow( c, 1.4 );
  return clamp( pow( abs( c ), 8.0 ), 0.0, 1.0 );
}

void main() {
  float t = uTime * 0.45 + 23.0;
  vec2 o = vec2( 0.0035, 0.0 );
  gl_FragColor = vec4( caustic( vUv + o, t ), caustic( vUv, t ), caustic( vUv - o, t ), 1.0 );
}
`;

/** A small tiling texture of moving caustics, re-rendered every frame and sampled by materials and the water pass. */
export class CausticsMap {
  readonly target: WebGLRenderTarget;
  private readonly material: ShaderMaterial;
  private readonly quad: FullScreenQuad;

  constructor(size = 512) {
    this.target = new WebGLRenderTarget(size, size, {
      wrapS: RepeatWrapping,
      wrapT: RepeatWrapping,
      magFilter: LinearFilter,
      minFilter: LinearMipmapLinearFilter,
      generateMipmaps: true,
      depthBuffer: false,
    });
    this.material = new ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: FULLSCREEN_VERTEX, fragmentShader, depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer: WebGLRenderer, time: number): void {
    this.material.uniforms.uTime.value = time;
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    this.quad.render(renderer);
    renderer.setRenderTarget(previous);
  }
}
