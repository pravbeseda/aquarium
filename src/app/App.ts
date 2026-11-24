import { MathUtils, PerspectiveCamera, Timer, Vector2, Vector3, WebGLRenderer } from 'three';
import { QUALITY, detectTier, parseUrlOptions, type QualitySettings, type UrlOptions } from './settings';
import { AdaptiveResolution } from '../core/adaptiveResolution';
import { mulberry32 } from '../core/random';
import { AssetLoader } from '../world/assets';
import { prefilterRoom } from '../world/Room';
import { World } from '../world/World';
import { CausticsMap } from '../render/CausticsMap';
import { RenderPipeline } from '../render/RenderPipeline';
import { SWIM, applyLook, createSwimmer, forwardVector, stepSwimmer, type Swimmer } from '../sim/swim';
import { FoodSystem } from '../sim/food';
import { Controls } from '../input/Controls';
import { KeyboardMouse } from '../input/KeyboardMouse';
import { TouchControls } from '../input/TouchControls';
import { Hud, showFatalError } from '../ui/Hud';

const SETTLED_LIFETIME = 25;
const START_POSE = { position: new Vector3(0.42, 0.24, 0.17), yaw: 0.95, pitch: 0.04 };

interface Running {
  world: World;
  pipeline: RenderPipeline;
  caustics: CausticsMap;
  swimmer: Swimmer;
  food: FoodSystem;
}

/** Composition root: wires rendering, simulation, input and UI together and runs the frame loop. */
export class App {
  private readonly root: HTMLElement;
  private readonly options: UrlOptions;
  private readonly quality: QualitySettings;
  private readonly touch: boolean;
  private readonly renderer: WebGLRenderer;
  private readonly camera = new PerspectiveCamera(62, 1, 0.004, 6);
  private readonly hud: Hud;
  private readonly controls: Controls;
  private readonly keyboard: KeyboardMouse;
  private readonly timer = new Timer();
  private readonly resolution: AdaptiveResolution;
  private running: Running | null = null;
  private playing = false;
  private time = 0;
  private tailPhase = 0;
  private roll = 0;
  private gulp = 0;
  private sizeKey = '';
  private statsFrames = 0;
  private statsTime = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.options = parseUrlOptions(location.search);
    this.touch = this.options.touchUi || matchMedia('(pointer: coarse)').matches;
    const tier = this.options.quality ?? detectTier({ coarsePointer: this.touch, cores: navigator.hardwareConcurrency || 4 });
    this.quality = QUALITY[tier];
    this.resolution = new AdaptiveResolution({ targetMs: 1000 / 58, min: 0.6 });

    this.hud = new Hud(root, this.touch);
    this.renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    // Alpha 0 marks "no opaque surface"; the water pass reads transparent coverage over the glass from it.
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMappingExposure = 1.05;
    root.prepend(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      showFatalError('The browser reset the graphics. Please reload the page.');
    });

    this.keyboard = new KeyboardMouse(this.renderer.domElement);
    const touchLayer = document.getElementById('touch-layer');
    if (!touchLayer) throw new Error('#touch-layer is missing from index.html');
    this.controls = new Controls([this.keyboard, new TouchControls(touchLayer)]);

    document.addEventListener('pointerlockchange', () => {
      if (this.playing && !this.touch && !this.keyboard.locked && !this.options.autostart) this.pause();
    });
  }

  async start(): Promise<void> {
    const loader = new AssetLoader((f) => this.hud.setProgress(f * 0.85, 'Filling the tank…'));
    const anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const [hdr, rocks, gravel, bark] = await Promise.all([
      loader.hdr(`room/lythwood_room_${this.quality.roomHdri}.hdr`),
      loader.model('rocks/rock_moss_set_01_1k.gltf'),
      loader.pbr('ganges_river_pebbles', anisotropy),
      loader.pbr('bark_willow_02', anisotropy),
    ]);

    this.hud.setProgress(0.9, 'Planting…');
    const caustics = new CausticsMap();
    const world = new World({ room: prefilterRoom(this.renderer, hdr), rocks, gravel, bark }, this.quality, caustics.target.texture);
    const pipeline = new RenderPipeline(world.look, { msaaSamples: this.quality.msaaSamples, bloom: this.quality.bloom, shaftSteps: this.quality.shaftSteps });
    const pose = this.options.camera;
    const swimmer = pose
      ? createSwimmer(new Vector3(...pose.position), pose.yaw, pose.pitch)
      : createSwimmer(START_POSE.position, START_POSE.yaw, START_POSE.pitch);
    const food = new FoodSystem(mulberry32(Date.now() & 0xffff), { firstFeeding: 12, interval: [35, 55], flakesPerFeeding: 18, settledLifetime: SETTLED_LIFETIME });
    this.running = { world, pipeline, caustics, swimmer, food };

    this.resize();
    this.placeCamera(0);
    await this.renderer.compileAsync(world.scene, this.camera);

    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    this.timer.connect(document);
    this.renderer.setAnimationLoop(() => this.frame());

    if (this.options.autostart) this.play();
    else this.hud.ready(() => this.play());
  }

  private play(): void {
    this.playing = true;
    this.hud.showOverlay(false);
    this.hud.flashHint();
    this.controls.setEnabled(true);
    if (!this.touch && !this.options.autostart) this.keyboard.requestLock();
  }

  private pause(): void {
    this.playing = false;
    this.controls.setEnabled(false);
    this.hud.showOverlay(true, true);
  }

  private resize(): void {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio) * this.resolution.scale;
    const key = `${width}x${height}@${ratio.toFixed(3)}`;
    if (key === this.sizeKey || !this.running) return;
    this.sizeKey = key;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    const aspect = width / Math.max(height, 1);
    this.camera.aspect = aspect;
    // Keep at least ~78° horizontally so portrait phones do not feel like a keyhole.
    const minHorizontal = MathUtils.degToRad(78);
    const vertical = Math.max(MathUtils.degToRad(62), 2 * Math.atan(Math.tan(minHorizontal / 2) / aspect));
    this.camera.fov = MathUtils.radToDeg(Math.min(vertical, MathUtils.degToRad(105)));
    this.camera.updateProjectionMatrix();
    const size = this.renderer.getDrawingBufferSize(new Vector2());
    this.running.pipeline.setSize(size.x, size.y);
  }

  private frame(): void {
    const r = this.running;
    if (!r) return;
    this.timer.update();
    const realDt = this.timer.getDelta();
    if (this.resolution.addFrame(realDt * 1000)) this.resize();
    const dt = Math.min(realDt, 1 / 20);
    this.time += dt;
    if (this.options.stats) this.logStats(realDt);

    if (this.playing) {
      const [yaw, pitch] = this.controls.takeLook();
      applyLook(r.swimmer, yaw, pitch);
      this.roll = MathUtils.lerp(this.roll, MathUtils.clamp(-yaw / Math.max(dt, 1e-3) * 0.04, -0.2, 0.2), 1 - Math.exp(-dt * 4));
      stepSwimmer(r.swimmer, this.controls.intent(), dt, r.world.collider);
    } else {
      this.roll *= Math.exp(-dt * 2);
    }

    const mouth = forwardVector(r.swimmer.yaw, r.swimmer.pitch).multiplyScalar(0.014).add(r.swimmer.position);
    const flakesInWater = r.food.flakes.filter((f) => !f.landed).map((f) => f.position);
    r.world.fish.update(dt, r.world.collider, r.swimmer.position, flakesInWater);
    const eaten = r.food.update(dt, [{ position: mouth, radius: 0.022 }, ...r.world.fish.mouths]);
    if (eaten.includes(0)) this.gulp = 1;

    this.placeCamera(dt);
    const pixelScale = this.renderer.getContext().drawingBufferHeight / (2 * Math.tan(MathUtils.degToRad(this.camera.fov) / 2));
    r.world.update(dt, this.time, this.camera, r.food.flakes, SETTLED_LIFETIME, pixelScale);
    r.pipeline.render(this.renderer, r.world.scene, this.camera, r.caustics, r.world.room, this.time, dt);
  }

  private logStats(realDt: number): void {
    this.statsFrames++;
    this.statsTime += realDt;
    if (this.statsTime < 2) return;
    const size = this.renderer.getDrawingBufferSize(new Vector2());
    console.info(`[aquarium] ${(this.statsFrames / this.statsTime).toFixed(1)} fps, ${size.x}x${size.y}, scale ${this.resolution.scale.toFixed(2)}`);
    this.statsFrames = 0;
    this.statsTime = 0;
  }

  /** Camera = fish eyes: follows the swimmer with a tail-beat sway, banking into turns and a small gulp when eating. */
  private placeCamera(dt: number): void {
    const s = this.running!.swimmer;
    const speed = s.velocity.length() / SWIM.cruiseSpeed;
    this.tailPhase += dt * (3 + 9 * Math.min(speed, 2.2));
    const sway = Math.sin(this.tailPhase);
    const idle = Math.sin(this.time * 0.9) * 0.0012;
    this.gulp = Math.max(0, this.gulp - dt * 3);

    this.camera.position.copy(s.position);
    this.camera.position.y += idle + sway * 0.0008 * Math.min(speed, 1.5);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(s.pitch + Math.sin(this.time * 0.6) * 0.008, s.yaw + sway * 0.012 * Math.min(speed, 1.5), this.roll);
    this.camera.zoom = 1 + this.gulp * 0.04;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
}
