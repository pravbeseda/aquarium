import type { SwimIntent } from '../sim/swim';
import { idleIntent, type InputSource } from './Controls';
import { joystickVector } from './joystick';

const STICK_RADIUS = 56;

/**
 * Twin-thumb touch controls: a floating joystick on the left half of the screen swims,
 * dragging on the right half looks around. Pushing the stick to the rim swims faster.
 */
export class TouchControls implements InputSource {
  readonly intent: SwimIntent = idleIntent();
  private readonly layer: HTMLElement;
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;
  private stickId: number | null = null;
  private lookId: number | null = null;
  private origin = { x: 0, y: 0 };
  private last = { x: 0, y: 0 };
  private yaw = 0;
  private pitch = 0;
  private enabled = false;

  constructor(layer: HTMLElement) {
    this.layer = layer;
    this.base = document.createElement('div');
    this.base.className = 'stick';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    this.base.append(this.knob);
    layer.append(this.base);

    layer.addEventListener('pointerdown', (e) => this.down(e));
    layer.addEventListener('pointermove', (e) => this.move(e));
    layer.addEventListener('pointerup', (e) => this.up(e));
    layer.addEventListener('pointercancel', (e) => this.up(e));
  }

  takeLook(): [number, number] {
    const out: [number, number] = [this.yaw, this.pitch];
    this.yaw = 0;
    this.pitch = 0;
    return out;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.layer.classList.toggle('active', enabled);
    if (!enabled) this.reset();
  }

  private down(e: PointerEvent): void {
    if (!this.enabled || e.pointerType === 'mouse') return;
    e.preventDefault();
    const leftHalf = e.clientX < window.innerWidth / 2;
    if (leftHalf && this.stickId === null) {
      this.stickId = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      this.base.style.transform = `translate(${e.clientX - STICK_RADIUS}px, ${e.clientY - STICK_RADIUS}px)`;
      this.knob.style.transform = 'translate(0px, 0px)';
      this.base.classList.add('visible');
    } else if (!leftHalf && this.lookId === null) {
      this.lookId = e.pointerId;
      this.last = { x: e.clientX, y: e.clientY };
    } else {
      return;
    }
    this.layer.setPointerCapture(e.pointerId);
  }

  private move(e: PointerEvent): void {
    if (e.pointerId === this.stickId) {
      const dx = e.clientX - this.origin.x;
      const dy = e.clientY - this.origin.y;
      const v = joystickVector(dx, dy, STICK_RADIUS);
      this.intent.forward = v.y;
      this.intent.strafe = v.x;
      this.intent.boost = Math.hypot(dx, dy) > STICK_RADIUS * 1.25;
      const len = Math.min(1, Math.hypot(dx, dy) / STICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      this.knob.style.transform = `translate(${Math.cos(angle) * len * STICK_RADIUS}px, ${Math.sin(angle) * len * STICK_RADIUS}px)`;
    } else if (e.pointerId === this.lookId) {
      // A full-width swipe turns roughly 180 degrees regardless of screen size.
      const k = Math.PI / Math.max(window.innerWidth, 1);
      this.yaw -= (e.clientX - this.last.x) * k;
      this.pitch -= (e.clientY - this.last.y) * k;
      this.last = { x: e.clientX, y: e.clientY };
    }
  }

  private up(e: PointerEvent): void {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.intent.forward = this.intent.strafe = 0;
      this.intent.boost = false;
      this.base.classList.remove('visible');
    } else if (e.pointerId === this.lookId) {
      this.lookId = null;
    }
  }

  private reset(): void {
    this.stickId = this.lookId = null;
    this.intent.forward = this.intent.strafe = this.intent.rise = 0;
    this.intent.boost = false;
    this.base.classList.remove('visible');
  }
}
