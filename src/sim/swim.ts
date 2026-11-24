import { MathUtils, Vector3 } from 'three';
import type { TankCollider } from './tank';

export const SWIM = {
  cruiseSpeed: 0.22,
  boostSpeed: 0.5,
  acceleration: 1.2,
  /** Exponential drag rate (1/s) applied when no thrust is given. */
  drag: 2.6,
  bodyRadius: 0.018,
  maxPitch: MathUtils.degToRad(80),
} as const;

/** Player intent, each axis in [-1, 1]. */
export interface SwimIntent {
  forward: number;
  strafe: number;
  rise: number;
  boost: boolean;
}

export interface Swimmer {
  position: Vector3;
  velocity: Vector3;
  yaw: number;
  pitch: number;
  /** Normalised thrust in [0, 1], drives tail-beat bobbing of the camera. */
  effort: number;
}

export function createSwimmer(position: Vector3, yaw: number, pitch: number): Swimmer {
  return { position: position.clone(), velocity: new Vector3(), yaw, pitch, effort: 0 };
}

/** Unit look direction for a YXZ (yaw, then pitch) camera that faces -Z at rest. */
export function forwardVector(yaw: number, pitch: number, target = new Vector3()): Vector3 {
  const c = Math.cos(pitch);
  return target.set(-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c);
}

export function applyLook(s: Swimmer, dYaw: number, dPitch: number): void {
  s.yaw += dYaw;
  s.pitch = MathUtils.clamp(s.pitch + dPitch, -SWIM.maxPitch, SWIM.maxPitch);
}

const fwd = new Vector3();
const right = new Vector3();
const wish = new Vector3();
const UP = new Vector3(0, 1, 0);

export function stepSwimmer(s: Swimmer, intent: SwimIntent, dt: number, collider: TankCollider): void {
  forwardVector(s.yaw, s.pitch, fwd);
  right.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));

  wish
    .set(0, 0, 0)
    .addScaledVector(fwd, intent.forward)
    .addScaledVector(right, intent.strafe)
    .addScaledVector(UP, intent.rise);
  const amount = Math.min(1, wish.length());
  s.effort = amount * (intent.boost ? 1 : 0.6);

  if (amount > 1e-4) {
    const maxSpeed = intent.boost ? SWIM.boostSpeed : SWIM.cruiseSpeed;
    wish.normalize().multiplyScalar(maxSpeed * amount);
    // Steer the velocity towards the wished velocity with bounded acceleration.
    const dv = wish.sub(s.velocity);
    const maxDv = SWIM.acceleration * (intent.boost ? 2 : 1) * dt;
    if (dv.length() > maxDv) dv.setLength(maxDv);
    s.velocity.add(dv);
    if (s.velocity.length() > maxSpeed) s.velocity.setLength(maxSpeed);
  } else {
    s.velocity.multiplyScalar(Math.exp(-SWIM.drag * dt));
  }

  s.position.addScaledVector(s.velocity, dt);
  const normal = collider.resolve(s.position, SWIM.bodyRadius);
  if (normal) {
    const into = s.velocity.dot(normal);
    if (into < 0) s.velocity.addScaledVector(normal, -into);
  }
}
