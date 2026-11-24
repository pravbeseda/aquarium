import { HalfFloatType, ShaderMaterial, WebGLRenderTarget, type Texture, type WebGLRenderer } from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';

/** A separable Gaussian blur into a half-resolution target; `spread` widens the taps in output texels. */
export class HalfResBlur {
  readonly target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
  private readonly temp = this.target.clone();
  private readonly horizontal = new ShaderMaterial({ ...HorizontalBlurShader, uniforms: { tDiffuse: { value: null }, h: { value: 0 } } });
  private readonly vertical = new ShaderMaterial({ ...VerticalBlurShader, uniforms: { tDiffuse: { value: null }, v: { value: 0 } } });
  private readonly quad = new FullScreenQuad();
  private readonly spread: number;

  constructor(spread = 1) {
    this.spread = spread;
  }

  /** Takes the full-resolution size the result will be composited at. */
  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width / 2));
    const h = Math.max(1, Math.round(height / 2));
    this.target.setSize(w, h);
    this.temp.setSize(w, h);
    this.horizontal.uniforms.h.value = this.spread / w;
    this.vertical.uniforms.v.value = this.spread / h;
  }

  render(renderer: WebGLRenderer, input: Texture): void {
    this.horizontal.uniforms.tDiffuse.value = input;
    this.quad.material = this.horizontal;
    renderer.setRenderTarget(this.temp);
    this.quad.render(renderer);

    this.vertical.uniforms.tDiffuse.value = this.temp.texture;
    this.quad.material = this.vertical;
    renderer.setRenderTarget(this.target);
    this.quad.render(renderer);
  }
}
