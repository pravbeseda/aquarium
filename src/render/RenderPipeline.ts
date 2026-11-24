import { DepthTexture, HalfFloatType, LinearFilter, Vector2, WebGLRenderTarget, type PerspectiveCamera, type Scene, type Texture, type WebGLRenderer } from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { WaterPass } from './passes/WaterPass';
import { ShaftsPass } from './passes/ShaftsPass';
import { FinalPass } from './passes/FinalPass';
import type { CausticsMap } from './CausticsMap';
import type { WaterLook } from '../world/environment';

export interface PipelineOptions {
  msaaSamples: number;
  bloom: boolean;
  shaftSteps: number;
}

/** Scene → water (fog, shafts, glass, room) → bloom → lens + tone mapping → screen. */
export class RenderPipeline {
  private readonly sceneTarget: WebGLRenderTarget;
  private readonly waterTarget: WebGLRenderTarget;
  private readonly waterPass: WaterPass;
  private readonly shaftsPass: ShaftsPass;
  private readonly bloom: UnrealBloomPass | null;
  private readonly finalPass = new FinalPass();
  private readonly look: WaterLook;
  private frame = 0;

  constructor(look: WaterLook, opts: PipelineOptions) {
    this.look = look;
    this.sceneTarget = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      samples: opts.msaaSamples,
      depthTexture: new DepthTexture(1, 1),
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });
    this.waterTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false });
    this.waterPass = new WaterPass(look);
    this.shaftsPass = new ShaftsPass(look, opts.shaftSteps);
    this.bloom = opts.bloom ? new UnrealBloomPass(new Vector2(1, 1), 0.25, 0.5, 1.6) : null;
  }

  setSize(width: number, height: number): void {
    this.sceneTarget.setSize(width, height);
    this.waterTarget.setSize(width, height);
    this.shaftsPass.setSize(width, height);
    this.bloom?.setSize(width, height);
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, caustics: CausticsMap, room: { texture: Texture; maxLod: number }, time: number, dt: number): void {
    caustics.render(renderer, time);

    renderer.setRenderTarget(this.sceneTarget);
    renderer.clear();
    renderer.render(scene, camera);

    const depth = this.sceneTarget.depthTexture as DepthTexture;
    this.shaftsPass.render(renderer, camera, depth, caustics.target.texture, time, this.frame++);
    this.waterPass.render(
      renderer,
      camera,
      { color: this.sceneTarget.texture, depth, shafts: this.shaftsPass.target.texture, room: room.texture, roomMaxLod: room.maxLod },
      this.waterTarget,
      time,
      this.look.roomBlur,
    );

    this.bloom?.render(renderer, this.waterTarget, this.waterTarget, dt, false);
    this.finalPass.render(renderer, this.waterTarget.texture, time);
  }
}
