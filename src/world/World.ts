import { Color, DirectionalLight, HemisphereLight, Scene, Vector3, type Mesh, type PerspectiveCamera, type ShaderMaterial, type Texture } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TANK, TankCollider } from '../sim/tank';
import { PLAYER_TRAIL_LENGTH, createUnderwaterUniforms, type UnderwaterUniforms } from '../render/underwaterMaterial';
import type { QualitySettings } from '../app/settings';
import type { PbrTextures } from './assets';
import { createWaterLook, type WaterLook } from './environment';
import { createSubstrate } from './Substrate';
import { createHardscape } from './Hardscape';
import { createPlants } from './plants/Plants';
import { createWaterSurface } from './WaterSurface';
import { Bubbles } from './Bubbles';
import { Particles } from './Particles';
import { FoodView } from './FoodView';
import { FishLife } from './fish/FishLife';
import type { Flake } from '../sim/food';
import type { RoomEnvironment } from './Room';

export interface WorldAssets {
  room: RoomEnvironment;
  rocks: GLTF;
  gravel: PbrTextures;
  bark: PbrTextures;
}

const lightDirView = new Vector3();
/** Seconds between samples of the player's path that plants are pushed away from. */
const TRAIL_INTERVAL = 0.12;

/** Builds the aquarium scene and keeps its animated parts in step with the simulation. */
export class World {
  readonly scene = new Scene();
  readonly look: WaterLook;
  readonly uniforms: UnderwaterUniforms;
  readonly collider: TankCollider;
  readonly fish: FishLife;
  readonly room: RoomEnvironment;
  private readonly surface: Mesh;
  private readonly bubbles: Bubbles;
  private readonly particles: Particles;
  private readonly food: FoodView;
  private readonly lamp: DirectionalLight;
  private trailTimer = 0;

  constructor(assets: WorldAssets, quality: QualitySettings, caustics: Texture) {
    this.look = createWaterLook();
    this.room = assets.room;
    this.uniforms = createUnderwaterUniforms(TANK.waterLevel, this.look.extinction, this.look.lightDir);
    this.uniforms.tCaustics.value = caustics;
    this.uniforms.uCausticScale.value = this.look.causticScale;

    const scene = this.scene;
    scene.environment = assets.room.texture;
    scene.environmentIntensity = 0.3;
    scene.environmentRotation.y = this.look.roomYaw;

    this.lamp = new DirectionalLight(this.look.lampColor, this.look.lampIntensity);
    const centre = new Vector3(0, TANK.waterLevel / 2, 0);
    this.lamp.position.copy(centre).addScaledVector(this.look.lightDir, -1.2);
    this.lamp.target.position.copy(centre);
    this.lamp.castShadow = true;
    const cam = this.lamp.shadow.camera;
    cam.left = -0.68;
    cam.right = 0.68;
    cam.top = 0.42;
    cam.bottom = -0.42;
    cam.near = 0.4;
    cam.far = 2.0;
    this.lamp.shadow.mapSize.setScalar(quality.shadowMapSize);
    this.lamp.shadow.bias = -0.0004;
    this.lamp.shadow.normalBias = 0.0015;
    this.lamp.shadow.radius = 3;
    scene.add(this.lamp, this.lamp.target);
    scene.add(new HemisphereLight(new Color(0.5, 0.72, 0.72), new Color(0.1, 0.08, 0.05), 0.55));

    const hardscape = createHardscape(this.uniforms, assets.rocks, assets.bark);
    this.collider = new TankCollider(hardscape.obstacles);
    scene.add(createSubstrate(this.uniforms, assets.gravel));
    scene.add(hardscape.group);
    scene.add(createPlants(this.uniforms, hardscape.obstacles, quality));

    this.bubbles = new Bubbles(this.uniforms, this.look.lampColor);
    this.surface = createWaterSurface(this.look, assets.room, this.bubbles.source);
    this.fish = new FishLife(this.uniforms, quality.neonCount);
    this.particles = new Particles(this.uniforms, this.look, quality.particles);
    this.food = new FoodView(this.uniforms, 96);
    scene.add(this.surface, this.bubbles.group, this.fish.group, this.food.mesh, this.particles.points);
  }

  update(dt: number, time: number, camera: PerspectiveCamera, flakes: readonly Flake[], settledLifetime: number, pixelScale: number): void {
    this.uniforms.uTime.value = time;
    this.updatePlayerTrail(dt, camera.position);
    (this.surface.material as ShaderMaterial).uniforms.uTime.value = time;
    lightDirView.copy(this.look.lightDir).transformDirection(camera.matrixWorldInverse);
    this.bubbles.update(dt, time, lightDirView);
    this.particles.update(camera.position, pixelScale);
    this.food.update(flakes, settledLifetime);
  }

  /** Newest point follows the player; older points lag behind and push less, so plants close up gently. */
  private updatePlayerTrail(dt: number, player: Vector3): void {
    const trail = this.uniforms.uPlayerTrail.value;
    this.trailTimer += dt;
    if (this.trailTimer >= TRAIL_INTERVAL) {
      this.trailTimer = 0;
      for (let k = PLAYER_TRAIL_LENGTH - 1; k > 0; k--) trail[k].copy(trail[k - 1]);
    }
    trail[0].set(player.x, player.y, player.z, 1);
    for (let k = 1; k < PLAYER_TRAIL_LENGTH; k++) trail[k].w = 1 - k / PLAYER_TRAIL_LENGTH;
  }
}
