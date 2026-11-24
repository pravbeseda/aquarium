import { ShaderMaterial, type Texture, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { FULLSCREEN_VERTEX } from '../waterGlsl';

// Lens imperfections, tone mapping and output encoding.
const fragmentShader = /* glsl */ `
uniform sampler2D tColor;
uniform float uAberration;
uniform float uVignette;
uniform float uTime;
varying vec2 vUv;

#include <tonemapping_pars_fragment>

float hash( vec2 p ) {
  return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
}

void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot( c, c );
  vec2 offset = c * r2 * uAberration;
  vec3 color = vec3(
    texture2D( tColor, vUv - offset ).r,
    texture2D( tColor, vUv ).g,
    texture2D( tColor, vUv + offset ).b
  );
  color *= 1.0 - uVignette * smoothstep( 0.05, 0.55, r2 );
  color = ACESFilmicToneMapping( color );
  color = sRGBTransferOETF( vec4( color, 1.0 ) ).rgb;
  color += ( hash( gl_FragCoord.xy + fract( uTime ) * 97.0 ) - 0.5 ) * ( 1.5 / 255.0 );
  gl_FragColor = vec4( color, 1.0 );
}
`;

export class FinalPass {
  private readonly material: ShaderMaterial;
  private readonly quad: FullScreenQuad;

  constructor() {
    this.material = new ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        toneMappingExposure: { value: 1 },
        uAberration: { value: 0.012 },
        uVignette: { value: 0.45 },
        uTime: { value: 0 },
      },
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  render(renderer: WebGLRenderer, input: Texture, time: number): void {
    const u = this.material.uniforms;
    u.tColor.value = input;
    u.toneMappingExposure.value = renderer.toneMappingExposure;
    u.uTime.value = time;
    renderer.setRenderTarget(null);
    this.quad.render(renderer);
  }

  dispose(): void {
    this.material.dispose();
    this.quad.dispose();
  }
}
