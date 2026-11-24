import type { SwimIntent } from '../sim/swim';
import { idleIntent, type InputSource } from './Controls';

const MOUSE_SENSITIVITY = 0.0022;

const BINDINGS: Record<string, [keyof Omit<SwimIntent, 'boost'>, number] | 'boost'> = {
  KeyW: ['forward', 1],
  ArrowUp: ['forward', 1],
  KeyS: ['forward', -1],
  ArrowDown: ['forward', -1],
  KeyD: ['strafe', 1],
  ArrowRight: ['strafe', 1],
  KeyA: ['strafe', -1],
  ArrowLeft: ['strafe', -1],
  Space: ['rise', 1],
  KeyE: ['rise', 1],
  KeyC: ['rise', -1],
  KeyQ: ['rise', -1],
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
};

/** WASD + mouse look. Uses pointer lock when available and falls back to dragging. */
export class KeyboardMouse implements InputSource {
  readonly intent: SwimIntent = idleIntent();
  private readonly held = new Set<string>();
  private readonly element: HTMLElement;
  private yaw = 0;
  private pitch = 0;
  private enabled = false;
  private dragging = false;

  constructor(element: HTMLElement) {
    this.element = element;
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.recompute();
    });
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    element.addEventListener('mousedown', (e) => {
      if (!this.enabled || e.button !== 0) return;
      if (document.pointerLockElement !== element) this.dragging = true;
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
  }

  get locked(): boolean {
    return document.pointerLockElement === this.element;
  }

  requestLock(): void {
    if (!this.element.requestPointerLock) return;
    try {
      const result = this.element.requestPointerLock() as unknown as Promise<void> | undefined;
      result?.catch(() => {
        // Lock refused (e.g. inside an iframe); dragging still works.
      });
    } catch {
      // Older browsers throw synchronously; dragging still works.
    }
  }

  takeLook(): [number, number] {
    const out: [number, number] = [this.yaw, this.pitch];
    this.yaw = 0;
    this.pitch = 0;
    return out;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.held.clear();
      this.recompute();
    }
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!(e.code in BINDINGS)) return;
    if (!this.enabled) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (down) this.held.add(e.code);
    else this.held.delete(e.code);
    this.recompute();
  }

  private recompute(): void {
    const i = this.intent;
    i.forward = i.strafe = i.rise = 0;
    i.boost = false;
    for (const code of this.held) {
      const b = BINDINGS[code];
      if (b === 'boost') i.boost = true;
      else i[b[0]] += b[1];
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.enabled || (!this.locked && !this.dragging)) return;
    this.yaw -= e.movementX * MOUSE_SENSITIVITY;
    this.pitch -= e.movementY * MOUSE_SENSITIVITY;
  }
}
