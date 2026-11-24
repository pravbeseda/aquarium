import { Color, Matrix3, Vector3 } from 'three';
import { TANK } from '../sim/tank';

/** Art direction for the water, the lamp and the room; one place to tune the look. */
export interface WaterLook {
  waterBoxMin: Vector3;
  waterBoxMax: Vector3;
  glassTop: number;
  /** Per-channel extinction (absorption + scattering) in 1/m. */
  extinction: Vector3;
  deepColor: Vector3;
  shallowColor: Vector3;
  lightDir: Vector3;
  lampColor: Color;
  lampIntensity: number;
  shaftColor: Vector3;
  shaftIntensity: number;
  causticScale: number;
  roomCenter: Vector3;
  roomRadius: number;
  roomIntensity: number;
  roomYaw: number;
  roomRotation: Matrix3;
  /** Fraction of the room cube map's mip chain used to blur the room seen through the front and side glass. */
  roomBlur: number;
  /** Relative index used at the glass; below water's 1.333 to widen the view out of the tank. */
  glassEta: number;
  /** Pendant LED lamp above the open-top tank, seen through the surface. */
  lamp: { center: Vector3; halfSize: [number, number]; radiance: Vector3 };
}

export function createWaterLook(): WaterLook {
  const roomYaw = -0.43;
  const lampColor = new Color(1.0, 0.95, 0.86);
  return {
    waterBoxMin: new Vector3(TANK.min.x, TANK.min.y, TANK.min.z),
    waterBoxMax: new Vector3(TANK.max.x, TANK.waterLevel, TANK.max.z),
    glassTop: TANK.max.y,
    extinction: new Vector3(1.15, 0.52, 0.62),
    deepColor: new Vector3(0.008, 0.04, 0.045),
    shallowColor: new Vector3(0.035, 0.15, 0.16),
    lightDir: new Vector3(0.22, -1, -0.14).normalize(),
    lampColor,
    lampIntensity: 3.6,
    shaftColor: new Vector3(lampColor.r, lampColor.g, lampColor.b),
    shaftIntensity: 1.6,
    causticScale: 10,
    roomCenter: new Vector3(0, 0.95, 0.35),
    roomRadius: 2.8,
    roomIntensity: 0.32,
    roomYaw,
    roomRotation: new Matrix3().set(Math.cos(roomYaw), 0, Math.sin(roomYaw), 0, 1, 0, -Math.sin(roomYaw), 0, Math.cos(roomYaw)),
    roomBlur: 0.15,
    glassEta: 1.07,
    lamp: {
      center: new Vector3(0, TANK.waterLevel + 0.32, 0),
      halfSize: [0.5, 0.09],
      radiance: new Vector3(lampColor.r, lampColor.g, lampColor.b).multiplyScalar(14),
    },
  };
}
