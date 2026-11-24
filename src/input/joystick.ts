/**
 * Converts a thumb offset in screen pixels (y down) into a stick vector:
 * x to the right, y forward (screen up), magnitude clamped to 1 with a rescaled dead zone.
 */
export function joystickVector(dx: number, dy: number, radius: number, deadZone = 0.12): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  const m = Math.min(1, len / radius);
  if (m <= deadZone || len === 0) return { x: 0, y: 0 };
  const scaled = (m - deadZone) / (1 - deadZone);
  return { x: (dx / len) * scaled, y: (-dy / len) * scaled };
}
